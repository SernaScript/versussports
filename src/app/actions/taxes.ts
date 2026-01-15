"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getTaxes(query?: string) {
    try {
        const where = query ? {
            name: { contains: query, mode: "insensitive" }
        } : undefined;

        const taxes = await prisma.siigoTax.findMany({
            where: where as any,
            orderBy: { name: "asc" },
            take: 100
        });
        return { success: true, data: taxes };
    } catch (error) {
        return { success: false, error: "Error fetching taxes" };
    }
}

export async function syncSiigoTaxes() {
    // Endpoint non-existent or not documented in PROJECT_CONTEXT.md
    return { success: true, count: 0 };
}
