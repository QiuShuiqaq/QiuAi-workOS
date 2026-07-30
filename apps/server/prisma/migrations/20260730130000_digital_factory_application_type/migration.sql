CREATE TYPE "RoleTemplateApplicationType" AS ENUM ('DIGITAL_EMPLOYEE', 'DIGITAL_FACTORY');

ALTER TABLE "role_templates"
  ADD COLUMN "application_type" "RoleTemplateApplicationType" NOT NULL DEFAULT 'DIGITAL_EMPLOYEE';

CREATE INDEX "role_templates_application_type_idx" ON "role_templates"("application_type");
