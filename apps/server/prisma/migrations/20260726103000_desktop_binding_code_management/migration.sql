ALTER TABLE "desktop_binding_codes" ADD COLUMN "label" TEXT;

ALTER TABLE "desktop_binding_codes" ALTER COLUMN "expires_at" DROP NOT NULL;
