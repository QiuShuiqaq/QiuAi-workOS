ALTER TABLE "role_templates"
  ADD COLUMN IF NOT EXISTS "dependency_manifest" JSONB NOT NULL DEFAULT '{}'::jsonb;
