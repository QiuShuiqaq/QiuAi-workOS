ALTER TABLE "role_templates"
ADD COLUMN "workflow_graph" JSONB NOT NULL DEFAULT '{}';
