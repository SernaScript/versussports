-- CreateTable
CREATE TABLE "siigo_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "class" TEXT,
    "level" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_expense_concepts" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_expense_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_settings" (
    "id" TEXT NOT NULL,
    "bank_account_code" TEXT,
    "journal_document_id" TEXT,
    "cost_center_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "siigo_accounts_code_key" ON "siigo_accounts"("code");

-- AddForeignKey
ALTER TABLE "bank_expense_concepts" ADD CONSTRAINT "bank_expense_concepts_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "siigo_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
