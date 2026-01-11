"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function getBankPeriods() {
    try {
        const periods = await prisma.bankPeriod.findMany({
            orderBy: { startDate: "desc" },
        });
        return { success: true, data: periods };
    } catch (error) {
        console.error("Error fetching bank periods:", error);
        return { success: false, error: "Failed to fetch bank periods" };
    }
}

export async function createBankPeriod(data: {
    name: string;
    startDate: Date;
    endDate: Date;
}) {
    try {
        const period = await prisma.bankPeriod.create({
            data: {
                name: data.name,
                startDate: data.startDate,
                endDate: data.endDate,
            },
        });
        revalidatePath("/conciliaciones");
        return { success: true, data: period };
    } catch (error) {
        console.error("Error creating bank period:", error);
        return { success: false, error: "Failed to create bank period" };
    }
}

export async function saveBankTransactions(
    periodId: string,
    transactions: any[]
) {
    try {
        // Prepare data for bulk insert
        // Ensure decimal conversion is handled or passed as numbers/strings that Prisma accepts for Decimal
        const formattedTransactions = transactions.map((tx) => ({
            date: new Date(tx.FECHA),
            description: tx["DESCRIPCIÓN"],
            branch: tx["SUCURSAL"] || null,
            documentId: tx["DCTO."] ? String(tx["DCTO."]) : null,
            amount: tx.VALOR, // Prisma handles number -> Decimal
            status: "PENDING",
            periodId: periodId,
        }));

        const result = await prisma.bankTransaction.createMany({
            data: formattedTransactions,
        });

        revalidatePath("/conciliaciones");
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Error saving transactions:", error);
        return { success: false, error: "Failed to save transactions" };
    }
}
