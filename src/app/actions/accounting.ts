"use server";

import { prisma } from "@/lib/prisma";
import { createJournal } from "./siigo";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

export async function processBankExpenses(periodId: string, accountingData: {
    documentId: number;
    bankAccountCode: string;
    date: string;
    observations: string;
}) {
    try {
        // 1. Fetch Configuration & Data
        const settings = await prisma.siigoSetting.findFirst();
        if (!settings?.bankNit) {
            return { success: false, error: "Falta el NIT del banco en la configuración global." };
        }

        const concepts = await prisma.bankExpenseConcept.findMany();
        if (concepts.length === 0) {
            return { success: false, error: "No hay conceptos definidos." };
        }

        const period = await prisma.bankPeriod.findUnique({
            where: { id: periodId },
            include: { transactions: { where: { status: "APPROVED" } } }
        });

        if (!period) return { success: false, error: "Periodo no encontrado" };
        if (period.transactions.length === 0) {
            return { success: false, error: "No hay transacciones aprobadas para contabilizar." };
        }

        // 2. Logic: Process All Approved Transactions
        const matchedTransactions: { txId: string, accountCode: string, amount: number, desc: string }[] = [];
        let unmatchedCount = 0;

        for (const tx of period.transactions) {
            const amount = Number(tx.amount);
            let matched = false;

            for (const concept of concepts) {
                const pattern = new RegExp(concept.pattern, 'i');
                if (pattern.test(tx.description)) {
                    matchedTransactions.push({
                        txId: tx.id,
                        accountCode: concept.accountCode,
                        amount: amount,
                        desc: tx.description
                    });
                    matched = true;
                    break;
                }
            }

            if (!matched) unmatchedCount++;
        }

        if (matchedTransactions.length === 0) {
            return {
                success: false,
                error: `No se identificaron movimientos con las reglas actuales. Hay ${unmatchedCount} sin asignar.`
            };
        }

        // 3. Group by Account
        const groupedMovements = matchedTransactions.reduce((acc, curr) => {
            if (!acc[curr.accountCode]) {
                acc[curr.accountCode] = 0;
            }
            acc[curr.accountCode] += curr.amount; // Net amount (could be pos or neg)
            return acc;
        }, {} as Record<string, number>);

        // 4. Build Journal Items
        const items = [];
        let totalBankNet = 0;
        const costCenter = settings.costCenterCode ? { code: settings.costCenterCode } : undefined;

        for (const [code, value] of Object.entries(groupedMovements)) {
            if (value === 0) continue;

            const isNetExpense = value < 0; // Negative bank movement = Expense (Debit on concept)
            const absoluteValue = Math.abs(value);

            items.push({
                account: {
                    code: code,
                    movement: isNetExpense ? "Debit" : "Credit"
                },
                customer: {
                    identification: settings.bankNit,
                    branch_office: 0
                },
                value: Number(absoluteValue.toFixed(2)),
                description: `Resumen ${isNetExpense ? 'Gastos' : 'Ingresos'} ${period.name} - ${code}`,
                cost_center: costCenter
            });

            totalBankNet += value;
        }

        // Bank Movement (Contra-partida/Salida de banco)
        if (totalBankNet !== 0) {
            const isNetInput = totalBankNet > 0;
            items.push({
                account: {
                    code: accountingData.bankAccountCode, // Use account from form
                    movement: isNetInput ? "Debit" : "Credit"
                },
                customer: {
                    identification: settings.bankNit,
                    branch_office: 0
                },
                value: Number(Math.abs(totalBankNet).toFixed(2)),
                description: `Suma neta movimientos bancarios ${period.name}`,
                cost_center: costCenter
            });
        }

        const journalPayload = {
            document: { id: accountingData.documentId },
            date: accountingData.date,
            items: items,
            observations: accountingData.observations
        };

        // 5. Send to Siigo
        const siigoRes = await createJournal(journalPayload);

        if (!siigoRes.success) {
            return { success: false, error: "Error Siigo: " + siigoRes.error };
        }

        // 6. Update Local Transactions
        const txIds = matchedTransactions.map(m => m.txId);

        await prisma.bankTransaction.updateMany({
            where: { id: { in: txIds } },
            data: {
                status: "RECONCILED",
                documentId: String(siigoRes.data.number || siigoRes.data.id)
            }
        });

        revalidatePath(`/conciliaciones/${periodId}`);
        return {
            success: true,
            message: `Contabilización exitosa. Referencia Siigo: ${siigoRes.data.number}.`,
            warning: unmatchedCount > 0 ? `${unmatchedCount} movimientos no coinciden con ninguna regla.` : undefined
        };

    } catch (error) {
        console.error("Error processing expenses:", error);
        return { success: false, error: "Error interno al procesar movimientos." };
    }
}



export async function getConsolidatedExpenses(periodId: string) {
    try {
        const concepts = await prisma.bankExpenseConcept.findMany({
            include: { account: true }
        });

        const transactions = await prisma.bankTransaction.findMany({
            where: {
                periodId,
                status: { in: ["PENDING", "APPROVED", "RECONCILED"] },
            }
        });

        if (transactions.length === 0) return { success: true, data: [] };

        const summary: Record<string, {
            conceptId: string,
            conceptAlias: string,
            accountCode: string,
            accountName: string,
            count: number,
            total: number,
            pendingCount: number,
            pendingTotal: number,
            approvedCount: number,
            approvedTotal: number,
            reconciledCount: number,
            reconciledTotal: number,
            vouchers: string[],
            transactions: any[]
        }> = {};

        const unmatched: any[] = [];

        for (const tx of transactions) {
            let matched = false;
            const amount = Number(tx.amount);

            for (const concept of concepts) {
                const pattern = new RegExp(concept.pattern, 'i');
                if (pattern.test(tx.description)) {
                    if (!summary[concept.id]) {
                        summary[concept.id] = {
                            conceptId: concept.id,
                            conceptAlias: concept.alias,
                            accountCode: concept.accountCode,
                            accountName: concept.account?.name || "",
                            count: 0,
                            total: 0,
                            pendingCount: 0,
                            pendingTotal: 0,
                            approvedCount: 0,
                            approvedTotal: 0,
                            reconciledCount: 0,
                            reconciledTotal: 0,
                            vouchers: [],
                            transactions: []
                        };
                    }
                    summary[concept.id].count++;
                    summary[concept.id].total += amount;

                    if (tx.status === "PENDING") {
                        summary[concept.id].pendingCount++;
                        summary[concept.id].pendingTotal += amount;
                    }
                    if (tx.status === "APPROVED") {
                        summary[concept.id].approvedCount++;
                        summary[concept.id].approvedTotal += amount;
                    }
                    if (tx.status === "RECONCILED") {
                        summary[concept.id].reconciledCount++;
                        summary[concept.id].reconciledTotal += amount;
                        if (tx.documentId && !summary[concept.id].vouchers.includes(tx.documentId)) {
                            summary[concept.id].vouchers.push(tx.documentId);
                        }
                    }

                    summary[concept.id].transactions.push({
                        ...tx,
                        amount: amount
                    });
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                unmatched.push({
                    ...tx,
                    amount: amount
                });
            }
        }

        const consolidatedArray = Object.values(summary);

        return {
            success: true,
            data: {
                consolidated: consolidatedArray,
                unmatched: unmatched,
                totalPendingCount: consolidatedArray.reduce((sum, s) => sum + s.pendingCount, 0) + (unmatched.filter(u => u.status === "PENDING").length),
                totalPendingSum: consolidatedArray.reduce((sum, s) => sum + s.pendingTotal, 0) + (unmatched.filter(u => u.status === "PENDING").reduce((s, u) => s + u.amount, 0)),
                totalApprovedCount: consolidatedArray.reduce((sum, s) => sum + s.approvedCount, 0),
                totalApprovedSum: consolidatedArray.reduce((sum, s) => sum + s.approvedTotal, 0),
                totalReconciledCount: consolidatedArray.reduce((sum, s) => sum + s.reconciledCount, 0),
                totalReconciledSum: consolidatedArray.reduce((sum, s) => sum + s.reconciledTotal, 0),
                totalMatchedSum: consolidatedArray.reduce((sum, s) => sum + s.total, 0),
                totalMatchedCount: consolidatedArray.reduce((sum, s) => sum + s.count, 0),
                totalUnmatched: unmatched.reduce((sum, u) => sum + u.amount, 0)
            }
        };

    } catch (error) {
        console.error("Error getting consolidated expenses:", error);
        return { success: false, error: "Error al consolidar gastos." };
    }
}

export async function approveMatchedExpenses(periodId: string, txIds: string[]) {
    try {
        await prisma.bankTransaction.updateMany({
            where: { id: { in: txIds } },
            data: { status: "APPROVED" }
        });
        revalidatePath(`/conciliaciones/${periodId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Error al aprobar gastos." };
    }
}
