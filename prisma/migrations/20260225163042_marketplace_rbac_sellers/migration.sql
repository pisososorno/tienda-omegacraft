-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'STORE_ADMIN', 'SELLER');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('pending', 'active', 'suspended', 'disabled');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'SELLER';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "seller_id" TEXT;

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "payout_email" VARCHAR(500),
    "payout_method" VARCHAR(50) NOT NULL DEFAULT 'paypal',
    "status" "SellerStatus" NOT NULL DEFAULT 'pending',
    "can_sell_plugins" BOOLEAN NOT NULL DEFAULT false,
    "can_sell_maps" BOOLEAN NOT NULL DEFAULT false,
    "can_sell_configurations" BOOLEAN NOT NULL DEFAULT false,
    "can_sell_source_code" BOOLEAN NOT NULL DEFAULT false,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "hold_days" INTEGER NOT NULL DEFAULT 14,
    "reserve_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE INDEX "products_seller_id_idx" ON "products"("seller_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: set the FIRST created admin user as SUPER_ADMIN (owner)
UPDATE "admin_users" SET "role" = 'SUPER_ADMIN'
WHERE "id" = (SELECT "id" FROM "admin_users" ORDER BY "created_at" ASC LIMIT 1);
