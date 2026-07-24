ALTER TABLE "role_templates"
  ADD COLUMN "workflow_steps" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "sample_inputs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "output_format" TEXT;
