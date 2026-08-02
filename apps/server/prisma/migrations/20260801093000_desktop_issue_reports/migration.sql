CREATE TYPE "DesktopIssueCategory" AS ENUM ('BUG', 'USAGE', 'FEATURE_REQUEST', 'BAD_OUTPUT', 'OTHER');
CREATE TYPE "DesktopIssueSeverity" AS ENUM ('NORMAL', 'IMPACTING', 'BLOCKING');
CREATE TYPE "DesktopIssueStatus" AS ENUM ('NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED');

CREATE TABLE "desktop_issue_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "issue_no" TEXT NOT NULL,
  "category" "DesktopIssueCategory" NOT NULL,
  "severity" "DesktopIssueSeverity" NOT NULL DEFAULT 'NORMAL',
  "status" "DesktopIssueStatus" NOT NULL DEFAULT 'NEW',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "contact" TEXT,
  "workspace_id" UUID,
  "desktop_device_id" UUID,
  "runtime_id" TEXT,
  "device_id" TEXT,
  "device_name" TEXT,
  "app_version" TEXT,
  "platform" TEXT,
  "diagnostics" JSONB,
  "admin_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "desktop_issue_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desktop_issue_reports_issue_no_key" ON "desktop_issue_reports"("issue_no");
CREATE INDEX "desktop_issue_reports_workspace_id_idx" ON "desktop_issue_reports"("workspace_id");
CREATE INDEX "desktop_issue_reports_desktop_device_id_idx" ON "desktop_issue_reports"("desktop_device_id");
CREATE INDEX "desktop_issue_reports_status_severity_created_at_idx" ON "desktop_issue_reports"("status", "severity", "created_at");
CREATE INDEX "desktop_issue_reports_category_idx" ON "desktop_issue_reports"("category");
CREATE INDEX "desktop_issue_reports_runtime_id_idx" ON "desktop_issue_reports"("runtime_id");
CREATE INDEX "desktop_issue_reports_created_at_idx" ON "desktop_issue_reports"("created_at");

ALTER TABLE "desktop_issue_reports"
  ADD CONSTRAINT "desktop_issue_reports_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "desktop_issue_reports"
  ADD CONSTRAINT "desktop_issue_reports_desktop_device_id_fkey"
  FOREIGN KEY ("desktop_device_id") REFERENCES "desktop_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
