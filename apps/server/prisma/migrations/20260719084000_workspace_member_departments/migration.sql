-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN "department_id" UUID;

-- CreateIndex
CREATE INDEX "workspace_members_department_id_idx" ON "workspace_members"("department_id");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
