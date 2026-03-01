-- AlterTable
ALTER TABLE "manual_sales" ADD COLUMN     "payment_proof_note" TEXT,
ADD COLUMN     "payment_verification_mode" VARCHAR(30),
ADD COLUMN     "paypal_payer_email" VARCHAR(500),
ADD COLUMN     "paypal_payer_name" VARCHAR(300);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_verification_mode" VARCHAR(30);
