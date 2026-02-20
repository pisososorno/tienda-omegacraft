-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('configurations', 'source_code', 'maps', 'plugins');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'confirmed', 'refunded', 'disputed', 'revoked', 'frozen');

-- CreateEnum
CREATE TYPE "DeliveryStageType" AS ENUM ('preview', 'full');

-- CreateEnum
CREATE TYPE "DeliveryStageStatus" AS ENUM ('pending', 'ready', 'delivered', 'revoked');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "short_description" VARCHAR(1000),
    "description" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "download_limit" INTEGER NOT NULL DEFAULT 3,
    "download_expires_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_files" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "alt_text" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_versions" (
    "id" TEXT NOT NULL,
    "version_label" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_snapshot" JSONB NOT NULL,
    "buyer_email" VARCHAR(500) NOT NULL,
    "buyer_ip" VARCHAR(45) NOT NULL,
    "buyer_user_agent" TEXT,
    "buyer_country" VARCHAR(100),
    "buyer_city" VARCHAR(200),
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "paypal_order_id" VARCHAR(100),
    "paypal_capture_id" VARCHAR(100),
    "paypal_payer_id" VARCHAR(100),
    "paypal_payer_email" VARCHAR(500),
    "paypal_status" VARCHAR(50),
    "paypal_raw_capture" JSONB,
    "paypal_webhook_received_at" TIMESTAMPTZ,
    "download_limit" INTEGER NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "downloads_expire_at" TIMESTAMPTZ,
    "downloads_revoked" BOOLEAN NOT NULL DEFAULT false,
    "terms_version_id" TEXT NOT NULL,
    "terms_accepted_at" TIMESTAMPTZ NOT NULL,
    "terms_accepted_ip" VARCHAR(45) NOT NULL,
    "terms_accepted_ua" TEXT,
    "delivery_package_key" VARCHAR(1000),
    "delivery_package_hash" VARCHAR(64),
    "delivery_package_generated_at" TIMESTAMPTZ,
    "buyer_ip_encrypted" BYTEA,
    "terms_accepted_ip_encrypted" BYTEA,
    "evidence_frozen_at" TIMESTAMPTZ,
    "evidence_frozen_by_admin" VARCHAR(500),
    "frozen_evidence_pdf_key" VARCHAR(1000),
    "retention_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "event_data" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "ip_encrypted" BYTEA,
    "user_agent" TEXT,
    "external_ref" VARCHAR(200),
    "prev_hash" VARCHAR(64),
    "event_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_snapshots" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "snapshot_type" VARCHAR(20) NOT NULL,
    "snapshot_json" JSONB,
    "snapshot_html_key" VARCHAR(1000),
    "snapshot_pdf_key" VARCHAR(1000),
    "snapshot_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_tokens" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "stage_id" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_stages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stage_type" "DeliveryStageType" NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "status" "DeliveryStageStatus" NOT NULL DEFAULT 'pending',
    "storage_key" VARCHAR(1000),
    "sha256_hash" VARCHAR(64),
    "filename" VARCHAR(500),
    "file_size" BIGINT,
    "download_limit" INTEGER NOT NULL DEFAULT 3,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "released_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "license_key" VARCHAR(100) NOT NULL,
    "buyer_email" VARCHAR(500) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "paypal_event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processing_result" TEXT,
    "linked_order_id" VARCHAR(100),
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(500) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "product_files_product_id_idx" ON "product_files"("product_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_buyer_email_idx" ON "orders"("buyer_email");

-- CreateIndex
CREATE INDEX "orders_paypal_order_id_idx" ON "orders"("paypal_order_id");

-- CreateIndex
CREATE INDEX "orders_paypal_capture_id_idx" ON "orders"("paypal_capture_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- CreateIndex
CREATE INDEX "order_events_event_type_idx" ON "order_events"("event_type");

-- CreateIndex
CREATE INDEX "order_events_created_at_idx" ON "order_events"("created_at");

-- CreateIndex
CREATE INDEX "order_events_external_ref_idx" ON "order_events"("external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "order_events_order_id_sequence_number_key" ON "order_events"("order_id", "sequence_number");

-- CreateIndex
CREATE INDEX "order_snapshots_order_id_idx" ON "order_snapshots"("order_id");

-- CreateIndex
CREATE INDEX "download_tokens_token_hash_idx" ON "download_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "delivery_stages_order_id_idx" ON "delivery_stages"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_stages_order_id_stage_order_key" ON "delivery_stages"("order_id", "stage_order");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_order_id_key" ON "licenses"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_order_id_idx" ON "licenses"("order_id");

-- CreateIndex
CREATE INDEX "licenses_license_key_idx" ON "licenses"("license_key");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_logs_paypal_event_id_key" ON "webhook_logs"("paypal_event_id");

-- CreateIndex
CREATE INDEX "webhook_logs_paypal_event_id_idx" ON "webhook_logs"("paypal_event_id");

-- CreateIndex
CREATE INDEX "webhook_logs_linked_order_id_idx" ON "webhook_logs"("linked_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_snapshots" ADD CONSTRAINT "order_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_tokens" ADD CONSTRAINT "download_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_stages" ADD CONSTRAINT "delivery_stages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
