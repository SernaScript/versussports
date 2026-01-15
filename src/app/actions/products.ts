"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getProducts(query?: string) {
    try {
        const where = query ? {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query } }
            ]
        } : undefined;

        const products = await prisma.siigoProduct.findMany({
            where: where as any,
            orderBy: { code: "asc" },
            take: 100
        });
        return { success: true, data: products };
    } catch (error) {
        return { success: false, error: "Error fetching products" };
    }
}

export async function syncSiigoProducts() {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Fetch products from Siigo
        const response = await fetch("https://api.siigo.com/v1/products", {
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
            return { success: false, error: "Error fetching products from Siigo API" };
        }

        const siigoProducts = await response.json();
        const products = Array.isArray(siigoProducts) ? siigoProducts : siigoProducts.results || [];

        // Upsert into DB
        let count = 0;
        for (const product of products) {
            // Convert siigoId to string (can be number or UUID)
            const siigoId = String(product.id);
            
            await prisma.siigoProduct.upsert({
                where: { siigoId },
                update: {
                    code: product.code || siigoId,
                    name: product.name || "",
                    description: product.description || null,
                    active: product.active !== false
                },
                create: {
                    siigoId,
                    code: product.code || siigoId,
                    name: product.name || "",
                    description: product.description || null,
                    active: product.active !== false
                }
            });
            count++;
        }

        revalidatePath("/ajustes");
        return { success: true, count };

    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: "Error syncing products" };
    }
}

export async function createProductInSiigo(data: {
    code: string;
    name: string;
    description?: string;
}) {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Create product in Siigo
        const response = await fetch("https://api.siigo.com/v1/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            body: JSON.stringify({
                code: data.code,
                name: data.name,
                description: data.description || null
            }),
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Siigo Create Product Error:", JSON.stringify(result, null, 2));
            return {
                success: false,
                error: result.Errors?.[0]?.Message || result.message || "Error al crear producto en Siigo"
            };
        }

        // Sync to update local DB
        await syncSiigoProducts();

        revalidatePath("/ajustes");
        return { success: true, data: result };

    } catch (error) {
        console.error("Error creating product:", error);
        return { success: false, error: "Error de comunicación con Siigo" };
    }
}
