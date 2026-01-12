"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getBankPeriods() {
    try {
        const periods = await prisma.bankPeriod.findMany({
            orderBy: { startDate: "desc" },
            include: {
                _count: {
                    select: { transactions: true }
                },
                transactions: {
                    select: { amount: true }
                }
            }
        });

        // Calculate totals for each period
        const periodsWithTotals = periods.map((period: any) => {
            const cargos = period.transactions
                .filter((t: any) => Number(t.amount) < 0)
                .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

            const abonos = period.transactions
                .filter((t: any) => Number(t.amount) > 0)
                .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

            return {
                ...period,
                cargos,
                abonos,
                // Remove transactions array to keep response light
                transactions: undefined
            };
        });

        return { success: true, data: periodsWithTotals };
    } catch (error) {
        console.error("Error fetching bank periods:", error);
        return { success: false, error: "Failed to fetch bank periods" };
    }
}

export async function getBankPeriodById(id: string) {
    try {
        const period = await prisma.bankPeriod.findUnique({
            where: { id },
            include: {
                transactions: {
                    orderBy: { date: "asc" }
                }
            }
        });

        if (!period) return { success: false, error: "Periodo no encontrado" };

        // Convert Decimal to numbers for serialization
        const serializedPeriod = {
            ...period,
            transactions: period.transactions.map((tx: any) => ({
                ...tx,
                amount: Number(tx.amount)
            }))
        };

        return { success: true, data: serializedPeriod };
    } catch (error) {
        console.error("Error fetching bank period:", error);
        return { success: false, error: "Failed to fetch bank period" };
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

/**
 * Obtiene la suma total de todos los cargos (negativos)
 * registrados en la base de datos.
 */
export async function getTotalCargosGlobal() {
    try {
        const result = await prisma.bankTransaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                amount: {
                    lt: 0,
                },
            },
        });
        return { success: true, total: Number(result._sum.amount || 0) };
    } catch (error) {
        console.error("Error calculating total cargos:", error);
        return { success: false, error: "Failed to calculate total cargos" };
    }
}
