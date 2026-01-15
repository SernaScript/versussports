-- DropForeignKey
ALTER TABLE "provider_accounting_configs" DROP CONSTRAINT "provider_accounting_configs_expense_account_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_accounting_configs" DROP CONSTRAINT "provider_accounting_configs_withholding_tax_id_fkey";

-- AddForeignKey
ALTER TABLE "provider_accounting_configs" ADD CONSTRAINT "provider_accounting_configs_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "siigo_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_accounting_configs" ADD CONSTRAINT "provider_accounting_configs_withholding_tax_id_fkey" FOREIGN KEY ("withholding_tax_id") REFERENCES "siigo_taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
