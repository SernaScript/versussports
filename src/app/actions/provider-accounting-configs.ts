"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getProviderAccountingConfigs(query?: string) {
  try {
    const q = query?.trim();
    const where = q
      ? {
          providerNit: { contains: q, mode: "insensitive" as const },
        }
      : undefined;

    const configs = await prisma.providerAccountingConfig.findMany({
      where: where as any,
      orderBy: { providerNit: "asc" },
      take: 200,
      include: {
        expenseAccount: true,
        withholdingTax: true,
      },
    });

    return { success: true, data: configs };
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

    await prisma.providerAccountingConfig.upsert({
      where: { providerNit },
      update: {
        expenseAccountId: data.expenseAccountId,
        withholdingTaxId: data.withholdingTaxId,
      },
      create: {
        providerNit,
        expenseAccountId: data.expenseAccountId,
        withholdingTaxId: data.withholdingTaxId,
      },
    });

    revalidatePath("/ajustes");
    return { success: true };
  } catch (error) {
    console.error("Error upserting provider accounting config:", error);
    return { success: false, error: "Error saving provider config" };
  }
}

