"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getProviderAccountingConfigs(params?: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const q = params?.query?.trim();
    const pageSize = Math.min(Math.max(Number(params?.pageSize ?? 20), 1), 100);
    const page = Math.max(Number(params?.page ?? 1), 1);

    const where = q
      ? ({
        OR: [
          { providerNit: { contains: q, mode: "insensitive" as const } },
          { providerName: { contains: q, mode: "insensitive" as const } },
        ],
      } as any)
      : undefined;

    const [total, configs] = await Promise.all([
      (prisma as any).providerAccountingConfig.count({ where: where as any }),
      (prisma as any).providerAccountingConfig.findMany({
        where: where as any,
        orderBy: { providerNit: "asc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          expenseAccount: true,
          withholdingTax: true,
        },
      }),
    ]);

    // Enhance and serialize
    const serialized = await Promise.all((configs as any[]).map(async (c) => {
      let pName = c.providerName;

      // Fallback: try to find name in invoices if missing
      if (!pName) {
        const inv = await (prisma as any).dianInvoice.findFirst({
          where: { issuerNit: c.providerNit },
          select: { issuerName: true }
        });
        if (inv) pName = inv.issuerName;
      }

      // Second Fallback: try to find in suppliers
      if (!pName) {
        const supp = await (prisma as any).siigoSupplier.findFirst({
          where: { identification: c.providerNit },
          select: { name: true }
        });
        if (supp) pName = supp.name;
      }

      return {
        providerNit: c.providerNit,
        providerName: pName || null,
        provider_name: pName || null, // Keep for backward compatibility in UI
        status: c.status,
        expenseAccountId: c.expenseAccountId,
        withholdingTaxId: c.withholdingTaxId,
        expenseAccount: c.expenseAccount,
        withholdingTax: c.withholdingTax,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
      };
    }));

    return { success: true, data: serialized, page, pageSize, total };
  } catch (error) {
    console.error("Error fetching provider accounting configs:", error);
    return { success: false, error: "Error fetching provider accounting configs" };
  }
}

export async function getWithholdingTaxes(query?: string) {
  try {
    const q = query?.trim();
    const where = {
      AND: [
        { type: { in: ["Retefuente", "Autorretencion"] } },
        ...(q
          ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { siigoId: { contains: q } },
              ],
            },
          ]
          : []),
      ],
    };

    const taxes = await prisma.siigoTax.findMany({
      where: where as any,
      orderBy: { name: "asc" },
      take: 100,
    });

    return { success: true, data: taxes };
  } catch (error) {
    console.error("Error fetching withholding taxes:", error);
    return { success: false, error: "Error fetching withholding taxes" };
  }
}

export async function upsertProviderAccountingConfig(data: {
  providerNit: string;
  expenseAccountId: string | null;
  withholdingTaxId: string | null;
}) {
  try {
    const providerNit = data.providerNit.trim();
    if (!providerNit) return { success: false, error: "providerNit es obligatorio" };

    // Try to find a name if we don't have one in the database already
    let nameToSave = null;
    const existing = await (prisma as any).providerAccountingConfig.findUnique({
      where: { providerNit },
      select: { providerName: true }
    });

    if (!existing?.providerName) {
      const inv = await (prisma as any).dianInvoice.findFirst({
        where: { issuerNit: providerNit },
        select: { issuerName: true }
      });
      if (inv) nameToSave = inv.issuerName;

      if (!nameToSave) {
        const supp = await (prisma as any).siigoSupplier.findFirst({
          where: { identification: providerNit },
          select: { name: true }
        });
        if (supp) nameToSave = supp.name;
      }
    }

    await (prisma as any).providerAccountingConfig.upsert({
      where: { providerNit },
      update: {
        expenseAccountId: data.expenseAccountId,
        withholdingTaxId: data.withholdingTaxId,
        status: "COMPLETED",
        ...(nameToSave ? { providerName: nameToSave } : {})
      },
      create: {
        providerNit,
        providerName: nameToSave,
        expenseAccountId: data.expenseAccountId,
        withholdingTaxId: data.withholdingTaxId,
        status: "COMPLETED",
      },
    });

    revalidatePath("/ajustes");
    return { success: true };
  } catch (error) {
    console.error("Error upserting provider accounting config:", error);
    return { success: false, error: "Error saving provider config" };
  }
}

