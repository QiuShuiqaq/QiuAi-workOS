CREATE TYPE "KnowledgeBaseScope" AS ENUM ('ENTERPRISE', 'LOCAL');

CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "KnowledgeBaseVersionStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

CREATE TABLE "knowledge_bases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "scope" "KnowledgeBaseScope" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_version_id" UUID,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_base_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "knowledge_base_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "file_data_base64" TEXT NOT NULL,
    "text_content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "KnowledgeBaseVersionStatus" NOT NULL DEFAULT 'READY',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_bases_workspace_id_scope_key" ON "knowledge_bases"("workspace_id", "scope");
CREATE INDEX "knowledge_bases_workspace_id_idx" ON "knowledge_bases"("workspace_id");
CREATE INDEX "knowledge_bases_scope_idx" ON "knowledge_bases"("scope");
CREATE INDEX "knowledge_bases_status_idx" ON "knowledge_bases"("status");
CREATE INDEX "knowledge_bases_current_version_id_idx" ON "knowledge_bases"("current_version_id");

CREATE UNIQUE INDEX "knowledge_base_versions_knowledge_base_id_version_number_key" ON "knowledge_base_versions"("knowledge_base_id", "version_number");
CREATE INDEX "knowledge_base_versions_knowledge_base_id_idx" ON "knowledge_base_versions"("knowledge_base_id");
CREATE INDEX "knowledge_base_versions_status_idx" ON "knowledge_base_versions"("status");
CREATE INDEX "knowledge_base_versions_is_enabled_idx" ON "knowledge_base_versions"("is_enabled");
CREATE INDEX "knowledge_base_versions_created_at_idx" ON "knowledge_base_versions"("created_at");

ALTER TABLE "knowledge_bases"
  ADD CONSTRAINT "knowledge_bases_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_bases"
  ADD CONSTRAINT "knowledge_bases_current_version_id_fkey"
  FOREIGN KEY ("current_version_id") REFERENCES "knowledge_base_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_base_versions"
  ADD CONSTRAINT "knowledge_base_versions_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
