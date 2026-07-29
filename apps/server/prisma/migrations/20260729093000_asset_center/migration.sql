CREATE TYPE "AssetDefinitionType" AS ENUM ('VARIABLE', 'MODEL', 'TOOL', 'ARTIFACT_TEMPLATE', 'NODE_TEMPLATE');

CREATE TYPE "AssetDefinitionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

CREATE TYPE "AssetDefinitionScope" AS ENUM ('SYSTEM', 'CUSTOM');

CREATE TABLE "asset_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "AssetDefinitionType" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" "AssetDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "scope" "AssetDefinitionScope" NOT NULL DEFAULT 'CUSTOM',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "schema" JSONB NOT NULL DEFAULT '{}',
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_definitions_type_key_key" ON "asset_definitions"("type", "key");

CREATE INDEX "asset_definitions_type_idx" ON "asset_definitions"("type");

CREATE INDEX "asset_definitions_status_idx" ON "asset_definitions"("status");

CREATE INDEX "asset_definitions_category_idx" ON "asset_definitions"("category");

CREATE INDEX "asset_definitions_sort_order_idx" ON "asset_definitions"("sort_order");
