-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "disabled_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_idx" ON "admin_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_id_idx" ON "admin_audit_logs"("target_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
