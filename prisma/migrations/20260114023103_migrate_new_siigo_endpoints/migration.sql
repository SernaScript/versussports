-- CreateTable
CREATE TABLE "siigo_suppliers" (
    "id" TEXT NOT NULL,
    "siigoId" INTEGER NOT NULL,
    "identification" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_cost_centers" (
    "id" TEXT NOT NULL,
    "siigoId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_products" (
    "id" TEXT NOT NULL,
    "siigoId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_taxes" (
    "id" TEXT NOT NULL,
    "siigoId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "rate" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_payment_types" (
    "id" TEXT NOT NULL,
    "siigoId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_payment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siigo_currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "siigo_suppliers_siigoId_key" ON "siigo_suppliers"("siigoId");

-- CreateIndex
CREATE UNIQUE INDEX "siigo_cost_centers_siigoId_key" ON "siigo_cost_centers"("siigoId");

-- CreateIndex
CREATE UNIQUE INDEX "siigo_products_siigoId_key" ON "siigo_products"("siigoId");

-- CreateIndex
CREATE UNIQUE INDEX "siigo_taxes_siigoId_key" ON "siigo_taxes"("siigoId");

-- CreateIndex
CREATE UNIQUE INDEX "siigo_payment_types_siigoId_key" ON "siigo_payment_types"("siigoId");

-- CreateIndex
CREATE UNIQUE INDEX "siigo_currencies_code_key" ON "siigo_currencies"("code");
