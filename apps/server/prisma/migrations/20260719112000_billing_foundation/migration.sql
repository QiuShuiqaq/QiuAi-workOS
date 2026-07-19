-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('ALIPAY');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "BillingOrderStatus" AS ENUM ('PENDING', 'PAID', 'CLOSED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_name" TEXT,
    "tax_id" TEXT,
    "contact_email" TEXT,
    "default_provider" "PaymentProvider",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_orders" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "billing_account_id" UUID,
    "plan_id" UUID NOT NULL,
    "subscription_id" UUID,
    "order_no" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "billing_cycle" "BillingCycle" NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "payment_url" TEXT,
    "provider_trade_no" TEXT,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "provider_trade_no" TEXT,
    "notify_payload" JSONB,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "notified_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_workspace_id_key" ON "billing_accounts"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_orders_order_no_key" ON "billing_orders"("order_no");

-- CreateIndex
CREATE INDEX "billing_orders_workspace_id_idx" ON "billing_orders"("workspace_id");

-- CreateIndex
CREATE INDEX "billing_orders_billing_account_id_idx" ON "billing_orders"("billing_account_id");

-- CreateIndex
CREATE INDEX "billing_orders_plan_id_idx" ON "billing_orders"("plan_id");

-- CreateIndex
CREATE INDEX "billing_orders_subscription_id_idx" ON "billing_orders"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_orders_status_idx" ON "billing_orders"("status");

-- CreateIndex
CREATE INDEX "billing_orders_provider_idx" ON "billing_orders"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_provider_trade_no_key" ON "payment_transactions"("provider", "provider_trade_no");

-- CreateIndex
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_provider_idx" ON "payment_transactions"("provider");

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
