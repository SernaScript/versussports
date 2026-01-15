"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getPaymentTypes(query?: string) {
    try {
        const where = query ? {
            name: { contains: query, mode: "insensitive" }
        } : undefined;

        const paymentTypes = await prisma.siigoPaymentType.findMany({
            where: where as any,
            orderBy: { name: "asc" },
            take: 100
        });
        return { success: true, data: paymentTypes };
    } catch (error) {
        return { success: false, error: "Error fetching payment types" };
    }
}

export async function syncSiigoPaymentTypes() {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Fetch payment types from Siigo
        // Endpoint: GET /v1/payment-types
        // Según la documentación, payment.id debe existir y es consultable por /payment-types
        const response = await fetch("https://api.siigo.com/v1/payment-types?document_type=FC", {
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
            return { success: false, error: "Error fetching payment types from Siigo API" };
        }

        const siigoPaymentTypes = await response.json();
        const paymentTypes = Array.isArray(siigoPaymentTypes) ? siigoPaymentTypes : siigoPaymentTypes.results || [];

        // Upsert into DB
        let count = 0;
        for (const paymentType of paymentTypes) {
            // Convert siigoId to string (Siigo returns numeric id, but we store as string)
            const siigoId = String(paymentType.id);

            await prisma.siigoPaymentType.upsert({
                where: { siigoId },
                update: {
                    name: paymentType.name || "",
                    active: paymentType.active !== false
                },
                create: {
                    siigoId,
                    name: paymentType.name || "",
                    active: paymentType.active !== false
                }
            });
            count++;
        }

        revalidatePath("/ajustes");
        return { success: true, count };

    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: "Error syncing payment types" };
    }
}
