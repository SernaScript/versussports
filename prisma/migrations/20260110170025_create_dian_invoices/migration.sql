-- CreateTable
CREATE TABLE "dian_invoices" (
    "id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "issuer_nit" TEXT NOT NULL,
    "issuer_name" TEXT NOT NULL,
    "receiver_nit" TEXT NOT NULL,
    "receiver_name" TEXT NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "inc" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "group" TEXT NOT NULL,
    "currency" TEXT,
    "payment_method" TEXT,
    "payment_medium" TEXT,
    "reception_date" TIMESTAMP(3),
    "ica" DECIMAL(15,2),
    "ic" DECIMAL(15,2),
    "stamp" DECIMAL(15,2),
    "inc_bags" DECIMAL(15,2),
    "carbon_tax" DECIMAL(15,2),
    "fuel_tax" DECIMAL(15,2),
    "data_tax" DECIMAL(15,2),
    "icl" DECIMAL(15,2),
    "inpp" DECIMAL(15,2),
    "ibua" DECIMAL(15,2),
    "icui" DECIMAL(15,2),
    "withheld_vat" DECIMAL(15,2),
    "withheld_income" DECIMAL(15,2),
    "withheld_ica" DECIMAL(15,2),
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dian_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dian_invoices_id_key" ON "dian_invoices"("id");
