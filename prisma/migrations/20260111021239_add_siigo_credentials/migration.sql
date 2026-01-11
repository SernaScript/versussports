-- CreateTable
CREATE TABLE "siigo_credentials" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "access_key" TEXT NOT NULL,
    "partner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siigo_credentials_pkey" PRIMARY KEY ("id")
);
