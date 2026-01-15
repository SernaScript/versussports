"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getCostCenters(query?: string) {
    try {
        const where = query ? {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query } }
            ]
        } : undefined;

        const costCenters = await prisma.siigoCostCenter.findMany({
            where: where as any,
            orderBy: { code: "asc" },
            take: 100
        });
        return { success: true, data: costCenters };
    } catch (error) {
        return { success: false, error: "Error fetching cost centers" };
    }
}

export async function syncSiigoCostCenters() {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Fetch cost centers from Siigo
        // Endpoint: GET /v1/cost-centers
        const response = await fetch("https://api.siigo.com/v1/cost-centers", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Siigo API Error:", errorText);
            return { success: false, error: "Error fetching cost centers from Siigo API" };
        }

        const siigoCostCenters = await response.json();
        const costCenters = Array.isArray(siigoCostCenters) ? siigoCostCenters : siigoCostCenters.results || [];

        // Upsert into DB
        let count = 0;
        for (const costCenter of costCenters) {
            // Convert siigoId to string (Siigo returns numeric id, but we store as string)
            const siigoId = String(costCenter.id);
            
            await prisma.siigoCostCenter.upsert({
                where: { siigoId },
                update: {
                    code: costCenter.code || siigoId,
                    name: costCenter.name || "",
                    active: costCenter.active !== false
                },
                create: {
                    siigoId,
                    code: costCenter.code || siigoId,
                    name: costCenter.name || "",
                    active: costCenter.active !== false
                }
            });
            count++;
        }

        revalidatePath("/ajustes");
        return { success: true, count };

    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: "Error syncing cost centers" };
    }
}
