CREATE TABLE "desktop_agreement_acceptances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agreement_key" TEXT NOT NULL,
  "agreement_version" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "runtime_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "device_name" TEXT,
  "platform" TEXT,
  "app_version" TEXT,
  "workspace_id" TEXT,
  "desktop_device_id" UUID,
  "consent_method" TEXT NOT NULL,
  "minimum_read_seconds" INTEGER,
  "actual_read_seconds" INTEGER,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "desktop_agreement_acceptances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "desktop_agreement_acceptances"
  ADD CONSTRAINT "desktop_agreement_acceptances_desktop_device_id_fkey"
  FOREIGN KEY ("desktop_device_id")
  REFERENCES "desktop_devices"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX "desktop_agreement_acceptances_agreement_key_agreement_version_content_hash_runtime_id_key"
  ON "desktop_agreement_acceptances"("agreement_key", "agreement_version", "content_hash", "runtime_id");

CREATE INDEX "desktop_agreement_acceptances_agreement_key_agreement_version_content_hash_idx"
  ON "desktop_agreement_acceptances"("agreement_key", "agreement_version", "content_hash");

CREATE INDEX "desktop_agreement_acceptances_runtime_id_device_id_idx"
  ON "desktop_agreement_acceptances"("runtime_id", "device_id");

CREATE INDEX "desktop_agreement_acceptances_workspace_id_idx"
  ON "desktop_agreement_acceptances"("workspace_id");

CREATE INDEX "desktop_agreement_acceptances_desktop_device_id_idx"
  ON "desktop_agreement_acceptances"("desktop_device_id");

CREATE INDEX "desktop_agreement_acceptances_accepted_at_idx"
  ON "desktop_agreement_acceptances"("accepted_at");
