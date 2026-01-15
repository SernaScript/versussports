"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

export async function getCurrencies(query?: string) {
    try {
        const where = query ? {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query, mode: "insensitive" } }
            ]
        } : undefined;

        const currencies = await prisma.siigoCurrency.findMany({
            where: where as any,
            orderBy: { code: "asc" },
            take: 100
        });
        return { success: true, data: currencies };
    } catch (error) {
        return { success: false, error: "Error fetching currencies" };
    }
}

export async function syncSiigoCurrencies() {
    // Endpoint non-existent or not documented in PROJECT_CONTEXT.md
    return { success: true, count: 0 };
}
