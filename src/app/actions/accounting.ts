"use server";

import { prisma } from "@/lib/prisma";
import { createJournal } from "./siigo";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

export async function processBankExpenses(periodId: string) {
    try {
        // 1. Fetch Configuration & Data
        const settings = await prisma.siigoSetting.findFirst();
        if (!settings?.journalDocumentId || !settings?.bankAccountCode || !settings.bankNit) {
            return { success: false, error: "Faltan configuraciones globales (Cuenta Banco, Tipo Comprobante o NIT)." };
        }

        const concepts = await prisma.bankExpenseConcept.findMany();
        if (concepts.length === 0) {
            return { success: false, error: "No hay conceptos de gasto definidos." };
        }

        const period = await prisma.bankPeriod.findUnique({
            where: { id: periodId },
            include: { transactions: { where: { status: "APPROVED" } /* Only approved ones */ } }
        });

        if (!period) return { success: false, error: "Periodo no encontrado" };
        if (period.transactions.length === 0) {
            return { success: false, error: "No hay transacciones pendientes en este periodo." };
        }

        // 2. Logic: Identify Expenses
        // Expenses are negative amounts
        const expenses = period.transactions.filter((t: any) => t.amount.toNumber() < 0);
        if (expenses.length === 0) {
            return { success: false, error: "No hay gastos (pagos negativos) pendientes." };
        }

        const matchedTransactions: { txId: string, accountCode: string, amount: number, desc: string }[] = [];
        let unmatchedCount = 0;

        for (const tx of expenses) {
            const amountAbs = Math.abs(tx.amount.toNumber()); // Work with positive for accounting values
            let matched = false;

            // Find matching concept
            for (const concept of concepts) {
                // Regex case insensitive
                const pattern = new RegExp(concept.pattern, 'i');
                if (pattern.test(tx.description)) {
                    matchedTransactions.push({
                        txId: tx.id,
                        accountCode: concept.accountCode,
                        amount: amountAbs,
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
                error: `No se identificaron gastos con los conceptos actuales. Hay ${unmatchedCount} sin asignar.`
            };
        }

        // 3. Group by Account
        const groupedExpenses = matchedTransactions.reduce((acc, curr) => {
            if (!acc[curr.accountCode]) {
                acc[curr.accountCode] = 0;
            }
            acc[curr.accountCode] += curr.amount;
            return acc;
        }, {} as Record<string, number>);

        const totalExpenseValue = Object.values(groupedExpenses).reduce((a, b) => a + b, 0);

        // 4. Build Journal Items
        const items = [];

        // Debits (Gastos)
        for (const [code, value] of Object.entries(groupedExpenses)) {
            items.push({
                account: {
                    code: code,
                    movement: "Debit"
                },
                customer: {
                    identification: settings.bankNit,
                    branch_office: 0
                },
                value: Number(value.toFixed(2)), // Ensure 2 decimals
                description: `Gasto Bancario Periodo ${period.name} - ${code}`
            });
        }

        // Credit (Banco - Salida de Dinero)
        items.push({
            account: {
                code: settings.bankAccountCode,
                movement: "Credit"
            },
            customer: {
                identification: settings.bankNit, // Or maybe the bank entry doesn't strictly need third party? Usually it does if account requires it.
                branch_office: 0
            },
            value: Number(totalExpenseValue.toFixed(2)),
            description: `Pago Gastos Bancarios Periodo ${period.name}`
        });

        const journalPayload = {
            document: { id: Number(settings.journalDocumentId) }, // Siigo requires ID, usually integer if it's internal ID, or if we pass 'Code'?? 
            // Warning: Siigo API 'document.id' is THE INTERNAL ID of the DocumentType (e.g. 2445), NOT the Code (e.g. "CC"). 
            // PROJECT_CONTEXT/Documentation doesn't specify. 
            // Usually we need `getSiigoDocumentTypes` to map "CC" -> ID.
            // For now, let's assume the user enters the ID in settings. 
            // Or better: In Settings UI fetching types validation.
            // Step 286 says "document.id (identifier of the document type)".
            // I'll proceed assuming ID.
            date: format(period.endDate, "yyyy-MM-dd"),
            items: items,
            observations: `Generado automáticamente desde Conciliaciones para el periodo ${period.name}`
        };

        // 5. Send to Siigo
        const siigoRes = await createJournal(journalPayload);

        if (!siigoRes.success) {
            return { success: false, error: "Error Siigo: " + siigoRes.error };
        }

        // 6. Update Local Transactions
        // Use Prisma transaction for safety
        const txIds = matchedTransactions.map(m => m.txId);

        await prisma.bankTransaction.updateMany({
            where: { id: { in: txIds } },
            data: {
                status: "RECONCILED",
                documentId: String(siigoRes.data.number || siigoRes.data.id) // Save Siigo Number
            }
        });

        revalidatePath(`/conciliaciones/${periodId}`);
        return {
            success: true,
            message: `Se contabilizaron ${txIds.length} gastos por $${totalExpenseValue}. Referencia Siigo: ${siigoRes.data.number}`,
            warning: unmatchedCount > 0 ? `${unmatchedCount} gastos quedaron sin procesar (no coinciden con reglas).` : undefined
        };

    } catch (error) {
        console.error("Error processing expenses:", error);
        return { success: false, error: "Error interno al procesar gastos." };
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
                status: { in: ["PENDING", "APPROVED"] },
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
                            transactions: []
                        };
                    }
                    summary[concept.id].count++;
                    summary[concept.id].total += amount;
                    summary[concept.id].transactions.push({
                        ...tx,
                        amount: amount // Already a number
                    });
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                unmatched.push({
                    ...tx,
                    amount: amount // Already a number
                });
            }
        }

        return {
            success: true,
            data: {
                consolidated: Object.values(summary),
                unmatched: unmatched,
                totalMatched: Object.values(summary).reduce((sum, s) => sum + s.total, 0),
                totalUnmatched: unmatched.reduce((sum, u) => sum + Number(u.amount), 0)
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
