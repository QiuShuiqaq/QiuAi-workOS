CREATE TYPE "RoleTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "role_templates"
  ADD COLUMN "status" "RoleTemplateStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "allowed_plan_codes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "visible_workspace_ids" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "last_tested_at" TIMESTAMP(3);

UPDATE "role_templates"
SET
  "allowed_plan_codes" = jsonb_build_array("recommended_plan_code"),
  "published_at" = "updated_at";

CREATE INDEX "role_templates_status_idx" ON "role_templates"("status");
