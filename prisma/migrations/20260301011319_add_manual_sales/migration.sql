-- CreateEnum
CREATE TYPE "ManualSaleStatus" AS ENUM ('draft', 'sent', 'paid', 'redeemed', 'expired', 'canceled');

-- CreateTable
CREATE TABLE "manual_sales" (
    "id" TEXT NOT NULL,
    "status" "ManualSaleStatus" NOT NULL DEFAULT 'draft',
    "buyer_email" VARCHAR(500) NOT NULL,
    "buyer_email_masked" VARCHAR(500) NOT NULL,
    "buyer_name" VARCHAR(300),
    "product_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_method" VARCHAR(50) NOT NULL DEFAULT 'paypal_invoice',
    "payment_ref" VARCHAR(500),
    "paid_at" TIMESTAMPTZ,
    "require_payment_first" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "redeem_token_hash" VARCHAR(64) NOT NULL,
    "redeem_expires_at" TIMESTAMPTZ NOT NULL,
    "max_redeems" INTEGER NOT NULL DEFAULT 1,
    "redeem_count" INTEGER NOT NULL DEFAULT 0,
    "redeemed_at" TIMESTAMPTZ,
    "order_id" TEXT,
    "created_by_admin_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "manual_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_sales_order_id_key" ON "manual_sales"("order_id");

-- CreateIndex
CREATE INDEX "manual_sales_buyer_email_idx" ON "manual_sales"("buyer_email");

-- CreateIndex
CREATE INDEX "manual_sales_status_idx" ON "manual_sales"("status");

-- CreateIndex
CREATE INDEX "manual_sales_redeem_token_hash_idx" ON "manual_sales"("redeem_token_hash");

-- CreateIndex
CREATE INDEX "manual_sales_product_id_idx" ON "manual_sales"("product_id");

-- CreateIndex
CREATE INDEX "manual_sales_order_id_idx" ON "manual_sales"("order_id");

-- CreateIndex
CREATE INDEX "manual_sales_created_at_idx" ON "manual_sales"("created_at");

-- AddForeignKey
ALTER TABLE "manual_sales" ADD CONSTRAINT "manual_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_sales" ADD CONSTRAINT "manual_sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_sales" ADD CONSTRAINT "manual_sales_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
