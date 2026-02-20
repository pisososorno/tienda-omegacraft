-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "buyer_name" VARCHAR(300) NOT NULL DEFAULT '',
ADD COLUMN     "paypal_payer_name" VARCHAR(300);
