"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getTaxes(query?: string) {
    try {
        const likeQuery = query ? `%${query}%` : null;

        let taxes: any[];
        if (query) {
            taxes = await prisma.$queryRaw`
                SELECT * FROM "siigo_taxes" 
                WHERE "name" ILIKE ${likeQuery}
                ORDER BY "name" ASC 
                LIMIT 100
            `;
        } else {
            taxes = await prisma.$queryRaw`
                SELECT * FROM "siigo_taxes" 
                ORDER BY "name" ASC 
                LIMIT 100
            `;
        }

        const mappedTaxes = taxes.map((t: any) => ({
            id: t.id,
            siigoId: t.siigoId || t.siigoid,
            name: t.name,
            type: t.type,
            percentage: t.percentage,
            rate: t.rate,
            active: t.active,
            createdAt: t.created_at || t.createdAt,
            updatedAt: t.updated_at || t.updatedAt
        }));

        return { success: true, data: mappedTaxes };
    } catch (error) {
        console.error("Error getTaxes (raw):", error);
        return { success: false, error: "Error fetching taxes" };
    }
}

export async function syncSiigoTaxes() {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo configuradas o fallo autenticación." };

        // Assuming standard endpoint /v1/taxes based on user request context. 
        // If this differs, it should be updated.
        const response = await fetch("https://api.siigo.com/v1/taxes", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorResult = await response.json();
            return {
                success: false,
                error: errorResult.message || `Error al obtener impuestos de Siigo (${response.status})`
            };
        }

        const responseBody = await response.json();

        let taxesList: any[] = [];
        if (Array.isArray(responseBody)) {
            taxesList = responseBody;
        } else if (responseBody && Array.isArray(responseBody.results)) {
            taxesList = responseBody.results;
        } else {
            console.error("Unknown Siigo Response format:", JSON.stringify(responseBody));
            return { success: false, error: "Formato de respuesta desconocido de Siigo" };
        }

        // Process and save/update taxes
        let count = 0;
        for (const tax of taxesList) {
            // Check if tax has minimum required fields
            if (!tax.id || !tax.name) continue;

            let percentageVal = tax.percentage !== undefined ? Number(tax.percentage) :
                (tax.Percentage !== undefined ? Number(tax.Percentage) : null);

            // Fallback: Parse from name if possible (e.g. "IVA 19%", "ReteICA 11.04")
            if (percentageVal === null && tax.name) {
                // 1. Look for explicit percentage "19%"
                const matchPercent = tax.name.match(/(\d+(\.\d+)?)%/);
                if (matchPercent) {
                    percentageVal = Number(matchPercent[1]);
                } else {
                    // 2. Look for "ReteICA 11.04" (number at end or space-separated)
                    // Be careful not to match dates or codes. Usually tax names are simple.
                    const matchNum = tax.name.match(/(\d+(\.\d+)?)$/);
                    if (matchNum) {
                        percentageVal = Number(matchNum[1]);
                    }
                }
            }

            // Normalization: Siigo sometimes returns 0.19 for 19%. We want 19.
            // Assumption: No tax is naturally < 1% AND expressed as 0.X (except weird ReteICA cases).
            // Actually, ReteICA 11.04 is per thousand (1.104%). 
            // If we get 0.19 -> 19. If we get 0.06 -> 6.
            // If we get 11.04 -> 11.04 (Stored as is, usually means per thousand in Colombia context if > 1 and < 20 for logic?)
            // Let's standard on "Percentage Number". 19 = 19%.
            if (percentageVal !== null && percentageVal > 0 && percentageVal < 1) {
                percentageVal = percentageVal * 100;
            }

            // Map fields
            const data = {
                siigoId: String(tax.id),
                name: tax.name,
                type: tax.type,
                percentage: percentageVal,
                active: tax.active !== undefined ? tax.active : true,
            };

            await prisma.siigoTax.upsert({
                where: { siigoId: String(tax.id) },
                update: data,
                create: data
            });
            count++;
        }

        revalidatePath("/ajustes"); // Or wherever taxes are displayed
        return { success: true, count, message: `Se sincronizaron ${count} impuestos exitosamente.` };

    } catch (error) {
        console.error("Error syncing taxes:", error);
        return { success: false, error: "Error interno al sincronizar impuestos" };
    }
}
