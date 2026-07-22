CREATE TABLE "admin_action_logs" (
    "id" UUID NOT NULL,
    "operator_account_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_action_logs_operator_account_id_idx" ON "admin_action_logs"("operator_account_id");
CREATE INDEX "admin_action_logs_action_idx" ON "admin_action_logs"("action");
CREATE INDEX "admin_action_logs_target_type_target_id_idx" ON "admin_action_logs"("target_type", "target_id");
CREATE INDEX "admin_action_logs_created_at_idx" ON "admin_action_logs"("created_at");

ALTER TABLE "admin_action_logs"
ADD CONSTRAINT "admin_action_logs_operator_account_id_fkey"
FOREIGN KEY ("operator_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
