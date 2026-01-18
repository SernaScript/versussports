"use server";

import { prisma } from "@/lib/prisma";
import { createJournal } from "./siigo";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";



const buildBankExpensesPayload = async (periodId: string, accountingData: {
    documentId: number;
    bankAccountCode: string;
    date: string;
    observations: string;
}, isPreview: boolean = false) => {
    // 1. Fetch Configuration & Data
    const settings = await prisma.siigoSetting.findFirst();
    const bankNit = settings?.bankNit || "890903938";

    if (!bankNit) {
        throw new Error("Falta el NIT del banco en la configuración global.");
    }

    const concepts = await prisma.bankExpenseConcept.findMany();
    if (concepts.length === 0) {
        throw new Error("No hay conceptos definidos.");
    }

    const period = await prisma.bankPeriod.findUnique({
        where: { id: periodId },
        include: { transactions: { where: { status: "APPROVED" } } }
    });

    if (!period) throw new Error("Periodo no encontrado");
    if (period.transactions.length === 0) {
        throw new Error("No hay transacciones aprobadas para contabilizar.");
    }

    // 2. Logic: Process All Approved Transactions
    const matchedTransactions: { txId: string, accountCode: string, amount: number, desc: string, conceptAlias: string }[] = [];
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
                    desc: tx.description,
                    conceptAlias: concept.alias
                });
                matched = true;
                break;
            }
        }

        if (!matched) unmatchedCount++;
    }

    if (matchedTransactions.length === 0) {
        throw new Error(`No se identificaron movimientos con las reglas actuales. Hay ${unmatchedCount} sin asignar.`);
    }

    // 3. Group by Account AND Concept
    // We want separate lines for each concept, even if they share an account.
    const groupedMovements = matchedTransactions.reduce((acc, curr) => {
        const key = `${curr.accountCode}|${curr.conceptAlias}`;
        if (!acc[key]) {
            acc[key] = {
                code: curr.accountCode,
                alias: curr.conceptAlias,
                value: 0
            };
        }
        acc[key].value += curr.amount;
        return acc;
    }, {} as Record<string, { code: string, alias: string, value: number }>);

    // 4. Build Journal Items
    const items = [];
    let totalBankNet = 0;
    const costCenter = settings?.costCenterCode ? { code: settings.costCenterCode } : undefined;

    for (const group of Object.values(groupedMovements)) {
        if (group.value === 0) continue;

        const isNetExpense = group.value < 0; // Negative bank movement = Expense (Debit on concept)
        const absoluteValue = Math.abs(group.value);

        items.push({
            account: {
                code: group.code,
                movement: isNetExpense ? "Debit" : "Credit"
            },
            customer: {
                identification: bankNit,
                branch_office: 0
            },
            value: Number(absoluteValue.toFixed(2)),
            description: `${group.alias} - ${period.name}`,
            cost_center: costCenter,
            tax: group.code.startsWith("24") ? {
                id: 27572,
                name: "IVA",
                type: "IVA",
                percentage: 19
            } : (group.code.startsWith("2365") ? {
                id: 27577,
                name: "RTE",
                type: "RTE",
                percentage: 4
            } : undefined)
        });

        totalBankNet += group.value;
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
                identification: bankNit,
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

    return { journalPayload, matchedTransactions, unmatchedCount, periodName: period.name };
};

export async function processBankExpenses(periodId: string, accountingData: {
    documentId: number;
    bankAccountCode: string;
    date: string;
    observations: string;
}) {
    try {
        const { journalPayload, matchedTransactions, unmatchedCount } = await buildBankExpensesPayload(periodId, accountingData);

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

    } catch (error: any) {
        console.error("Error processing expenses:", error);
        return { success: false, error: error.message || "Error interno al procesar movimientos." };
    }
}

export async function previewBankExpensesAccounting(periodId: string, accountingData: {
    documentId: number;
    bankAccountCode: string;
    date: string;
    observations: string;
}) {
    try {
        const { journalPayload } = await buildBankExpensesPayload(periodId, accountingData, true);
        return {
            success: true,
            payload: journalPayload,
            endpoint: "POST https://api.siigo.com/v1/journals"
        };
    } catch (error: any) {
        return { success: false, error: error.message || "Error generando vista previa." };
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
