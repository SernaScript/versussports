"use server";

import { prisma } from "@/lib/prisma";
// Note: we intentionally avoid revalidatePath here to prevent UI refresh after saving.

export async function getProviderAccountingConfigs(params?: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const q = params?.query?.trim();
    const pageSize = Math.min(Math.max(Number(params?.pageSize ?? 20), 1), 100);
    const page = Math.max(Number(params?.page ?? 1), 1);

    // We can't rely on Prisma Client having providerName/status fields until it's regenerated.
    // So for searching by provider name, we use SQL directly against provider_accounting_configs.provider_name.
    let total = 0;
    let pageNits: string[] | null = null;

    if (q) {
      try {
        const like = `%${q}%`;
        const totalRes = await prisma.$queryRaw<Array<{ total: bigint }>>`
          SELECT COUNT(*)::bigint AS total
          FROM "provider_accounting_configs"
          WHERE "provider_nit" ILIKE ${like}
             OR "provider_name" ILIKE ${like}
        `;
        total = Number((totalRes?.[0]?.total ?? 0) as any);

        const rows = await prisma.$queryRaw<Array<{ provider_nit: string }>>`
          SELECT "provider_nit"
          FROM "provider_accounting_configs"
          WHERE "provider_nit" ILIKE ${like}
             OR "provider_name" ILIKE ${like}
          ORDER BY "provider_nit" ASC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        `;
        pageNits = rows.map((r) => r.provider_nit);
      } catch (e) {
        // If provider_name column isn't available yet, fallback to NIT-only search via Prisma.
        pageNits = null;
      }
    }

    let configs: any[] = [];
    if (pageNits) {
      configs = await (prisma as any).providerAccountingConfig.findMany({
        where: { providerNit: { in: pageNits } },
        include: { expenseAccount: true, withholdingTax: true },
      });
      // Ensure deterministic ordering by providerNit
      const byNit = new Map(configs.map((c) => [c.providerNit, c]));
      configs = pageNits.map((nit) => byNit.get(nit)).filter(Boolean);
    } else {
      const where = q
        ? ({
          providerNit: { contains: q, mode: "insensitive" as const },
        } as any)
        : undefined;

      const [t, list] = await Promise.all([
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
      total = Number(t);
      configs = list;
    }

    // Enhance and serialize
    const serialized = await Promise.all((configs as any[]).map(async (c) => {
      let pName: string | null = null;
      let status: string | null = null;

      // Try to read provider_name/status directly from DB (works even if Prisma Client isn't regenerated yet)
      try {
        const rows = await prisma.$queryRaw<Array<{ provider_name: string | null; status: string | null }>>`
          SELECT "provider_name", "status"
          FROM "provider_accounting_configs"
          WHERE "provider_nit" = ${c.providerNit}
          LIMIT 1
        `;
        if (rows?.[0]) {
          pName = rows[0].provider_name;
          status = rows[0].status;
        }
      } catch (e) {
        // ignore; we'll fallback below
      }

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
        provider_name: pName || null, // UI compatibility
        status: status || (c.status ?? null),
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

    const normalizeUpper = (value: any) => String(value ?? "").trim().toUpperCase();

    // Try to find a name if we don't have one in the database already (read via SQL to avoid Prisma schema mismatch)
    let existingName: string | null = null;
    try {
      const rows = await prisma.$queryRaw<Array<{ provider_name: string | null }>>`
        SELECT "provider_name"
        FROM "provider_accounting_configs"
        WHERE "provider_nit" = ${providerNit}
        LIMIT 1
      `;
      existingName = rows?.[0]?.provider_name ?? null;
    } catch (e) {
      existingName = null;
    }

    let nameToSave: string | null = null;
    if (!existingName) {
      const inv = await (prisma as any).dianInvoice.findFirst({
        where: { issuerNit: providerNit },
        select: { issuerName: true }
      });
      if (inv?.issuerName) nameToSave = normalizeUpper(inv.issuerName);

      if (!nameToSave) {
        const supp = await (prisma as any).siigoSupplier.findFirst({
          where: { identification: providerNit },
          select: { name: true }
        });
        if (supp?.name) nameToSave = normalizeUpper(supp.name);
      }
    }

    await (prisma as any).providerAccountingConfig.upsert({
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

    // Persist status/provider_name via SQL (works even if Prisma Client isn't regenerated yet)
    try {
      await prisma.$executeRaw`
        UPDATE "provider_accounting_configs"
        SET
          "status" = 'COMPLETED',
          "provider_name" = CASE
            WHEN ("provider_name" IS NULL OR BTRIM("provider_name") = '') AND ${nameToSave} IS NOT NULL
            THEN ${nameToSave}
            ELSE "provider_name"
          END,
          "updated_at" = NOW()
        WHERE "provider_nit" = ${providerNit}
      `;
    } catch (e) {
      // ignore if columns don't exist yet
    }

    // Read final values (for optimistic UI updates)
    let provider_name: string | null = null;
    let status: string | null = "COMPLETED";
    try {
      const rows = await prisma.$queryRaw<Array<{ provider_name: string | null; status: string | null }>>`
        SELECT "provider_name", "status"
        FROM "provider_accounting_configs"
        WHERE "provider_nit" = ${providerNit}
        LIMIT 1
      `;
      provider_name = rows?.[0]?.provider_name ?? provider_name;
      status = rows?.[0]?.status ?? status;
    } catch (e) {
      // ignore
    }

    return { success: true, data: { provider_nit: providerNit, provider_name, status } };
  } catch (error) {
    console.error("Error upserting provider accounting config:", error);
    return { success: false, error: "Error saving provider config" };
  }
}

