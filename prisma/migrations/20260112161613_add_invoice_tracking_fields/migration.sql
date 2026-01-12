-- AlterTable
ALTER TABLE "dian_invoices" ADD COLUMN "is_accounted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_downloaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "xml_url" TEXT,
ADD COLUMN "pdf_url" TEXT;
