-- AlterTable: provider_accounting_configs
ALTER TABLE "provider_accounting_configs"
ADD COLUMN "provider_name" TEXT;

ALTER TABLE "provider_accounting_configs"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Backfill/Upsert provider_name + status from existing DIAN invoices (idempotent).
INSERT INTO "provider_accounting_configs" (
    "provider_nit",
    "provider_name",
    "status",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    TRIM(di."issuer_nit") AS provider_nit,
    NULLIF(UPPER(TRIM(di."issuer_name")), '') AS provider_name,
    'PENDING' AS status,
    NOW() AS created_at,
    NOW() AS updated_at
FROM "dian_invoices" di
WHERE di."issuer_nit" IS NOT NULL
  AND TRIM(di."issuer_nit") <> ''
ON CONFLICT ("provider_nit")
DO UPDATE SET
    "provider_name" = CASE
        WHEN "provider_accounting_configs"."provider_name" IS NULL
             OR BTRIM("provider_accounting_configs"."provider_name") = ''
        THEN EXCLUDED."provider_name"
        ELSE "provider_accounting_configs"."provider_name"
    END,
    "updated_at" = NOW();

