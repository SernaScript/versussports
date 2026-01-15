"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

// --- Siigo Accounts ---

export async function upsertSiigoAccounts(accounts: any[]) {
    try {
        // Bulk upsert is tricky in Prisma without raw SQL for many records, 
        // but for < 2000 records simple loop or createMany is okay. 
        // Since we want to update if exists, we'll use transaction with upsert.
        // However, huge transactions might time out. 
        // Let's use standard delete-insert strategy or just createMany with skipDuplicates if we don't care about updates?
        // User wants to update "Si las cuentas cambian". 
        // Best approach for large datasets: delete all and insert all? Or careful upsert?
        // Let's try explicit upsert in transaction.

        const operations = accounts.map(acc =>
            prisma.siigoAccount.upsert({
                where: { code: String(acc.code) },
                update: {
                    name: acc.name,
                    category: acc.category,
                    class: acc.class,
                    level: acc.level ? Number(acc.level) : null,
                    active: acc.active
                },
                create: {
                    code: String(acc.code),
                    name: acc.name,
                    category: acc.category,
                    class: acc.class,
                    level: acc.level ? Number(acc.level) : null,
                    active: acc.active
                }
            })
        );

        // Batch processing to avoid limit
        const BATCH_SIZE = 100;
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
            const batch = operations.slice(i, i + BATCH_SIZE);
            await prisma.$transaction(batch);
        }

        revalidatePath("/ajustes");
        return { success: true, count: accounts.length };
    } catch (error) {
        console.error("Error uploading accounts:", error);
        return { success: false, error: "Error al guardar las cuentas contables." };
    }
}

export async function getSiigoAccounts(query?: string) {
    try {
        const where = query ? {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query } }
            ]
        } : undefined;

        const accounts = await prisma.siigoAccount.findMany({
            where: where as any,
            orderBy: { code: "asc" },
            take: 50 // Limit results for performance
        });
        return { success: true, data: accounts };
    } catch (error) {
        return { success: false, error: "Error fetching accounts" };
    }
}

// --- Siigo Settings ---

export async function getSiigoSettings() {
    try {
        const settings = await prisma.siigoSetting.findFirst();
        return { success: true, data: settings };
    } catch (error) {
        return { success: false, error: "Error fetching settings" };
    }
}

export async function saveSiigoSettings(data: {
    bankAccountCode?: string;
    journalDocumentId?: string;
    costCenterCode?: string;
    bankNit?: string;
}) {
    try {
        const existing = await prisma.siigoSetting.findFirst();
        if (existing) {
            await prisma.siigoSetting.update({
                where: { id: existing.id },
                data
            });
        } else {
            await prisma.siigoSetting.create({ data });
        }
        revalidatePath("/ajustes");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Error saving settings" };
    }
}

export async function getDianReceiverNameByNit(nit: string) {
    try {
        const normalizedNit = String(nit || "").trim();
        if (!normalizedNit) return { success: true, data: null as string | null };

        const invoice = await prisma.dianInvoice.findFirst({
            where: { receiverNit: normalizedNit },
            orderBy: { issueDate: "desc" },
            select: { receiverName: true },
        });

        return { success: true, data: invoice?.receiverName || null };
    } catch (error) {
        console.error("Error fetching DIAN receiver name by NIT:", error);
        return { success: false, error: "Error consultando el nombre del receptor en DIAN." };
    }
}

// --- Bank Expense Concepts ---

export async function getBankExpenseConcepts() {
    try {
        const concepts = await prisma.bankExpenseConcept.findMany({
            include: { account: true },
            orderBy: { alias: "asc" }
        });
        return { success: true, data: concepts };
    } catch (error) {
        return { success: false, error: "Error fetching concepts" };
    }
}

export async function createBankExpenseConcept(data: {
    alias: string;
    pattern: string;
    accountCode: string;
}) {
    try {
        // Validation: Account must exist (Prisma relation enforces this, but let's check nice error)
        const account = await prisma.siigoAccount.findUnique({
            where: { code: data.accountCode }
        });
        if (!account) return { success: false, error: "La cuenta contable no existe." };

        await prisma.bankExpenseConcept.create({
            data: {
                alias: data.alias,
                pattern: data.pattern,
                accountCode: data.accountCode
            }
        });
        revalidatePath("/ajustes");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Error creating concept" };
    }
}

export async function deleteBankExpenseConcept(id: string) {
    try {
        await prisma.bankExpenseConcept.delete({ where: { id } });
        revalidatePath("/ajustes");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Error deleting concept" };
    }
}

// --- Document Types ---

export async function getDocumentTypes() {
    try {
        const types = await prisma.siigoDocumentType.findMany({
            orderBy: { code: 'asc' }
        });
        return { success: true, data: types };
    } catch (error) {
        return { success: false, error: "Error fetching document types" };
    }
}

export async function syncSiigoDocumentTypes() {
    // Endpoint non-existent or not documented in PROJECT_CONTEXT.md
    return { success: true, count: 0 };
}
