ALTER TABLE "role_templates"
ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN "skills" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "role_instances"
ADD COLUMN "template_version" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN "skills" JSONB NOT NULL DEFAULT '[]'::jsonb;
