-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "store_name" VARCHAR(200) NOT NULL DEFAULT 'TiendaDigital',
    "store_slogan" VARCHAR(500) NOT NULL DEFAULT 'Productos digitales premium para Minecraft',
    "contact_email" VARCHAR(500) NOT NULL DEFAULT 'support@tiendadigital.com',
    "privacy_email" VARCHAR(500) NOT NULL DEFAULT 'privacy@tiendadigital.com',
    "appearance" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
