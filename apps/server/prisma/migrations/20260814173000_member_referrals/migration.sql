ALTER TYPE "AiPointCreditBucketSourceType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';

CREATE TYPE "ReferralCodeStatus" AS ENUM (
  'ACTIVE',
  'DISABLED'
);

CREATE TYPE "ReferralInviteStatus" AS ENUM (
  'PENDING',
  'PAID',
  'REWARDED',
  'REJECTED'
);

CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_account_id" UUID NOT NULL,
    "owner_workspace_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_code_id" UUID NOT NULL,
    "inviter_account_id" UUID NOT NULL,
    "inviter_workspace_id" UUID NOT NULL,
    "invitee_account_id" UUID NOT NULL,
    "invitee_workspace_id" UUID NOT NULL,
    "billing_order_id" UUID NOT NULL,
    "status" "ReferralInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitee_reward_points" INTEGER NOT NULL DEFAULT 0,
    "inviter_reward_points" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "rewarded_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_codes_owner_account_id_key" ON "referral_codes"("owner_account_id");
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");
CREATE INDEX "referral_codes_owner_workspace_id_idx" ON "referral_codes"("owner_workspace_id");
CREATE INDEX "referral_codes_status_idx" ON "referral_codes"("status");

CREATE UNIQUE INDEX "referral_invites_billing_order_id_key" ON "referral_invites"("billing_order_id");
CREATE INDEX "referral_invites_referral_code_id_idx" ON "referral_invites"("referral_code_id");
CREATE INDEX "referral_invites_inviter_account_id_idx" ON "referral_invites"("inviter_account_id");
CREATE INDEX "referral_invites_invitee_account_id_idx" ON "referral_invites"("invitee_account_id");
CREATE INDEX "referral_invites_inviter_workspace_id_idx" ON "referral_invites"("inviter_workspace_id");
CREATE INDEX "referral_invites_invitee_workspace_id_idx" ON "referral_invites"("invitee_workspace_id");
CREATE INDEX "referral_invites_status_idx" ON "referral_invites"("status");
CREATE INDEX "referral_invites_created_at_idx" ON "referral_invites"("created_at");

ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_owner_account_id_fkey"
  FOREIGN KEY ("owner_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_owner_workspace_id_fkey"
  FOREIGN KEY ("owner_workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_referral_code_id_fkey"
  FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_inviter_account_id_fkey"
  FOREIGN KEY ("inviter_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_inviter_workspace_id_fkey"
  FOREIGN KEY ("inviter_workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_invitee_account_id_fkey"
  FOREIGN KEY ("invitee_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_invitee_workspace_id_fkey"
  FOREIGN KEY ("invitee_workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_billing_order_id_fkey"
  FOREIGN KEY ("billing_order_id") REFERENCES "billing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
