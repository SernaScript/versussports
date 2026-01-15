-- CreateTable
CREATE TABLE "provider_accounting_configs" (
    "provider_nit" TEXT NOT NULL,
    "expense_account_id" TEXT,
    "withholding_tax_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounting_configs_pkey" PRIMARY KEY ("provider_nit")
);

-- AddForeignKey
ALTER TABLE "provider_accounting_configs" ADD CONSTRAINT "provider_accounting_configs_expense_account_id_fkey"
FOREIGN KEY ("expense_account_id") REFERENCES "siigo_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_accounting_configs" ADD CONSTRAINT "provider_accounting_configs_withholding_tax_id_fkey"
FOREIGN KEY ("withholding_tax_id") REFERENCES "siigo_taxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate that withholding_tax_id (when present) points to a SiigoTax of type Retefuente or Autorretencion.
-- NOTE: In Postgres, CHECK constraints cannot reference other tables, so we use a trigger.
CREATE OR REPLACE FUNCTION validate_provider_accounting_configs_withholding_tax_type()
RETURNS TRIGGER AS $$
DECLARE
    v_type TEXT;
BEGIN
    IF NEW.withholding_tax_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT "type" INTO v_type
    FROM "siigo_taxes"
    WHERE "id" = NEW.withholding_tax_id;

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'Invalid withholding_tax_id: tax not found or tax.type is NULL (withholding_tax_id=%)', NEW.withholding_tax_id;
    END IF;

    IF v_type NOT IN ('Retefuente', 'Autorretencion') THEN
        RAISE EXCEPTION 'Invalid withholding_tax_id: siigo_taxes.type must be Retefuente or Autorretencion (withholding_tax_id=%, type=%)', NEW.withholding_tax_id, v_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provider_accounting_configs_withholding_tax_type ON "provider_accounting_configs";

CREATE TRIGGER trg_validate_provider_accounting_configs_withholding_tax_type
BEFORE INSERT OR UPDATE OF "withholding_tax_id"
ON "provider_accounting_configs"
FOR EACH ROW
EXECUTE FUNCTION validate_provider_accounting_configs_withholding_tax_type();

