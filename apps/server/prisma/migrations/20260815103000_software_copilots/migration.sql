CREATE TYPE "SoftwareCopilotProductStatus" AS ENUM ('ACTIVE', 'COMING_SOON', 'ARCHIVED');

CREATE TYPE "SoftwareCopilotLicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TYPE "SoftwareCopilotDeviceBindingStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "software_copilot_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "software_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SoftwareCopilotProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "personal_monthly_price_cents" INTEGER NOT NULL,
    "personal_annual_price_cents" INTEGER NOT NULL,
    "enterprise_monthly_unit_price_cents" INTEGER NOT NULL,
    "enterprise_annual_unit_price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "sort_order" INTEGER NOT NULL DEFAULT 1000,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_copilot_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_copilot_licenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "status" "SoftwareCopilotLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_cycle" "BillingCycle" NOT NULL,
    "seat_limit" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_copilot_licenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_copilot_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "license_id" UUID,
    "order_no" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "billing_cycle" "BillingCycle" NOT NULL,
    "seat_count" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "payment_url" TEXT,
    "provider_trade_no" TEXT,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_copilot_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "software_copilot_device_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "desktop_device_id" UUID NOT NULL,
    "status" "SoftwareCopilotDeviceBindingStatus" NOT NULL DEFAULT 'ACTIVE',
    "bound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_copilot_device_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "software_copilot_products_code_key" ON "software_copilot_products"("code");
CREATE INDEX "software_copilot_products_status_sort_order_idx" ON "software_copilot_products"("status", "sort_order");

CREATE INDEX "software_copilot_licenses_workspace_id_status_idx" ON "software_copilot_licenses"("workspace_id", "status");
CREATE INDEX "software_copilot_licenses_product_id_status_idx" ON "software_copilot_licenses"("product_id", "status");
CREATE INDEX "software_copilot_licenses_period_end_idx" ON "software_copilot_licenses"("period_end");

CREATE UNIQUE INDEX "software_copilot_orders_order_no_key" ON "software_copilot_orders"("order_no");
CREATE INDEX "software_copilot_orders_workspace_id_idx" ON "software_copilot_orders"("workspace_id");
CREATE INDEX "software_copilot_orders_product_id_idx" ON "software_copilot_orders"("product_id");
CREATE INDEX "software_copilot_orders_license_id_idx" ON "software_copilot_orders"("license_id");
CREATE INDEX "software_copilot_orders_status_idx" ON "software_copilot_orders"("status");
CREATE INDEX "software_copilot_orders_provider_idx" ON "software_copilot_orders"("provider");

CREATE UNIQUE INDEX "software_copilot_device_bindings_license_id_desktop_device_id_key" ON "software_copilot_device_bindings"("license_id", "desktop_device_id");
CREATE INDEX "software_copilot_device_bindings_workspace_id_status_idx" ON "software_copilot_device_bindings"("workspace_id", "status");
CREATE INDEX "software_copilot_device_bindings_product_id_status_idx" ON "software_copilot_device_bindings"("product_id", "status");
CREATE INDEX "software_copilot_device_bindings_desktop_device_id_status_idx" ON "software_copilot_device_bindings"("desktop_device_id", "status");

ALTER TABLE "software_copilot_licenses" ADD CONSTRAINT "software_copilot_licenses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_copilot_licenses" ADD CONSTRAINT "software_copilot_licenses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "software_copilot_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "software_copilot_orders" ADD CONSTRAINT "software_copilot_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_copilot_orders" ADD CONSTRAINT "software_copilot_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "software_copilot_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_copilot_orders" ADD CONSTRAINT "software_copilot_orders_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_copilot_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "software_copilot_device_bindings" ADD CONSTRAINT "software_copilot_device_bindings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_copilot_device_bindings" ADD CONSTRAINT "software_copilot_device_bindings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "software_copilot_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_copilot_device_bindings" ADD CONSTRAINT "software_copilot_device_bindings_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_copilot_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_copilot_device_bindings" ADD CONSTRAINT "software_copilot_device_bindings_desktop_device_id_fkey" FOREIGN KEY ("desktop_device_id") REFERENCES "desktop_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
