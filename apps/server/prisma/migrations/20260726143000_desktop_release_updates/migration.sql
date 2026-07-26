CREATE TYPE "DesktopReleaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "desktop_releases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'windows',
  "channel" TEXT NOT NULL DEFAULT 'stable',
  "download_url" TEXT NOT NULL,
  "release_notes" TEXT,
  "checksum_sha256" TEXT,
  "file_size_bytes" INTEGER,
  "force_update" BOOLEAN NOT NULL DEFAULT false,
  "minimum_supported_version" TEXT,
  "status" "DesktopReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "desktop_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desktop_releases_platform_channel_version_key"
  ON "desktop_releases"("platform", "channel", "version");

CREATE INDEX "desktop_releases_platform_channel_status_published_at_idx"
  ON "desktop_releases"("platform", "channel", "status", "published_at");

CREATE INDEX "desktop_releases_status_idx"
  ON "desktop_releases"("status");
