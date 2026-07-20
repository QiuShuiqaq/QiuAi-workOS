-- CreateTable
CREATE TABLE "desktop_runtime_syncs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "runtime_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "runtime_snapshot" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desktop_runtime_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "desktop_runtime_syncs_runtime_id_key" ON "desktop_runtime_syncs"("runtime_id");

-- CreateIndex
CREATE INDEX "desktop_runtime_syncs_workspace_id_idx" ON "desktop_runtime_syncs"("workspace_id");

-- CreateIndex
CREATE INDEX "desktop_runtime_syncs_synced_at_idx" ON "desktop_runtime_syncs"("synced_at");

-- AddForeignKey
ALTER TABLE "desktop_runtime_syncs" ADD CONSTRAINT "desktop_runtime_syncs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
