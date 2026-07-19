-- CreateEnum
CREATE TYPE "RoleInstanceStatus" AS ENUM ('RUNNING', 'TRIAL', 'CONFIGURATION_REQUIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskArtifactType" AS ENUM ('TEXT', 'REPORT', 'VIDEO', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "ExecutionLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "role_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommended_plan_code" TEXT NOT NULL,
    "business_goal" TEXT NOT NULL,
    "knowledge_sources" JSONB NOT NULL,
    "tools" JSONB NOT NULL,
    "approval_policy" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_instances" (
    "id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "department_id" UUID,
    "owner_member_id" UUID,
    "name" TEXT NOT NULL,
    "status" "RoleInstanceStatus" NOT NULL DEFAULT 'CONFIGURATION_REQUIRED',
    "business_goal" TEXT NOT NULL,
    "knowledge_sources" JSONB NOT NULL,
    "tools" JSONB NOT NULL,
    "approval_policy" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role_instance_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "input" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_runs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "status" "TaskRunStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_artifacts" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "type" "TaskArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "level" "ExecutionLogLevel" NOT NULL DEFAULT 'INFO',
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_records" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_templates_recommended_plan_code_idx" ON "role_templates"("recommended_plan_code");

-- CreateIndex
CREATE INDEX "role_instances_template_id_idx" ON "role_instances"("template_id");

-- CreateIndex
CREATE INDEX "role_instances_workspace_id_idx" ON "role_instances"("workspace_id");

-- CreateIndex
CREATE INDEX "role_instances_department_id_idx" ON "role_instances"("department_id");

-- CreateIndex
CREATE INDEX "role_instances_owner_member_id_idx" ON "role_instances"("owner_member_id");

-- CreateIndex
CREATE INDEX "role_instances_status_idx" ON "role_instances"("status");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_idx" ON "tasks"("workspace_id");

-- CreateIndex
CREATE INDEX "tasks_role_instance_id_idx" ON "tasks"("role_instance_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_updated_at_idx" ON "tasks"("updated_at");

-- CreateIndex
CREATE INDEX "task_runs_task_id_idx" ON "task_runs"("task_id");

-- CreateIndex
CREATE INDEX "task_runs_status_idx" ON "task_runs"("status");

-- CreateIndex
CREATE INDEX "task_runs_created_at_idx" ON "task_runs"("created_at");

-- CreateIndex
CREATE INDEX "task_artifacts_task_id_idx" ON "task_artifacts"("task_id");

-- CreateIndex
CREATE INDEX "task_artifacts_type_idx" ON "task_artifacts"("type");

-- CreateIndex
CREATE INDEX "execution_logs_task_id_idx" ON "execution_logs"("task_id");

-- CreateIndex
CREATE INDEX "execution_logs_level_idx" ON "execution_logs"("level");

-- CreateIndex
CREATE INDEX "execution_logs_event_type_idx" ON "execution_logs"("event_type");

-- CreateIndex
CREATE INDEX "execution_logs_created_at_idx" ON "execution_logs"("created_at");

-- CreateIndex
CREATE INDEX "cost_records_workspace_id_idx" ON "cost_records"("workspace_id");

-- CreateIndex
CREATE INDEX "cost_records_task_id_idx" ON "cost_records"("task_id");

-- CreateIndex
CREATE INDEX "cost_records_provider_idx" ON "cost_records"("provider");

-- CreateIndex
CREATE INDEX "cost_records_created_at_idx" ON "cost_records"("created_at");

-- AddForeignKey
ALTER TABLE "role_instances" ADD CONSTRAINT "role_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "role_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_instances" ADD CONSTRAINT "role_instances_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_instances" ADD CONSTRAINT "role_instances_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_instances" ADD CONSTRAINT "role_instances_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_role_instance_id_fkey" FOREIGN KEY ("role_instance_id") REFERENCES "role_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_artifacts" ADD CONSTRAINT "task_artifacts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
