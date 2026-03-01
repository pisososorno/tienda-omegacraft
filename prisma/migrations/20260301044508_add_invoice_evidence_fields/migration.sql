-- AlterTable
ALTER TABLE "manual_sales" ADD COLUMN     "amount_discount" DECIMAL(10,2),
ADD COLUMN     "amount_shipping" DECIMAL(10,2),
ADD COLUMN     "amount_subtotal" DECIMAL(10,2),
ADD COLUMN     "amount_tax" DECIMAL(10,2),
ADD COLUMN     "paypal_invoice_id" VARCHAR(100),
ADD COLUMN     "paypal_invoice_number" VARCHAR(100),
ADD COLUMN     "paypal_paid_at" TIMESTAMPTZ,
ADD COLUMN     "paypal_raw" JSONB,
ADD COLUMN     "paypal_status" VARCHAR(50),
ADD COLUMN     "paypal_transaction_id" VARCHAR(100),
ADD COLUMN     "verified_at" TIMESTAMPTZ,
ADD COLUMN     "verified_via_api" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_method" VARCHAR(50),
ADD COLUMN     "payment_reference_url" VARCHAR(1000),
ADD COLUMN     "paypal_invoice_id" VARCHAR(100),
ADD COLUMN     "paypal_invoice_number" VARCHAR(100),
ADD COLUMN     "paypal_transaction_id" VARCHAR(100);

-- CreateTable
CREATE TABLE "payment_evidence_attachments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_evidence_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_evidence_attachments_order_id_idx" ON "payment_evidence_attachments"("order_id");

-- AddForeignKey
ALTER TABLE "payment_evidence_attachments" ADD CONSTRAINT "payment_evidence_attachments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_evidence_attachments" ADD CONSTRAINT "payment_evidence_attachments_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
