UPDATE "plans" AS p
SET
  "price_cents" = v.price_cents,
  "description" = v.description,
  "updated_at" = NOW()
FROM (
  VALUES
    ('ENTERPRISE_BASIC_MONTHLY'::"PlanCode", 28800, '适合小团队试点，开放 10 台设备、企业知识库、数字员工和数字工厂。'),
    ('ENTERPRISE_BASIC_ANNUAL'::"PlanCode", 288000, '企业基础版年付，按 10 个月计费；可定制 1 个数字工厂，解释权以运营方为准。'),
    ('ENTERPRISE_STANDARD_MONTHLY'::"PlanCode", 58800, '适合正常企业团队使用，开放 30 台设备、企业知识库、数字员工和数字工厂。'),
    ('ENTERPRISE_STANDARD_ANNUAL'::"PlanCode", 588000, '企业标准版年付，按 10 个月计费；可定制 1 个数字工厂，解释权以运营方为准。'),
    ('ENTERPRISE_PRO_MONTHLY'::"PlanCode", 88800, '适合多团队或高频生产使用，开放 80 台设备、企业知识库、数字员工和数字工厂。'),
    ('ENTERPRISE_PRO_ANNUAL'::"PlanCode", 888000, '企业专业版年付，按 10 个月计费；可定制 1 个数字工厂，解释权以运营方为准。')
) AS v(code, price_cents, description)
WHERE p."code" = v.code;

WITH entitlement_updates AS (
  SELECT *
  FROM (
    VALUES
      ('ENTERPRISE_BASIC_MONTHLY'::"PlanCode", 'maxDesktopDevices', 10),
      ('ENTERPRISE_BASIC_ANNUAL'::"PlanCode", 'maxDesktopDevices', 10),
      ('ENTERPRISE_STANDARD_MONTHLY'::"PlanCode", 'maxDesktopDevices', 30),
      ('ENTERPRISE_STANDARD_ANNUAL'::"PlanCode", 'maxDesktopDevices', 30),
      ('ENTERPRISE_PRO_MONTHLY'::"PlanCode", 'maxDesktopDevices', 80),
      ('ENTERPRISE_PRO_ANNUAL'::"PlanCode", 'maxDesktopDevices', 80),
      ('ENTERPRISE_BASIC_MONTHLY'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_BASIC_ANNUAL'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_STANDARD_MONTHLY'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_STANDARD_ANNUAL'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_PRO_MONTHLY'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_PRO_ANNUAL'::"PlanCode", 'maxRoleInstances', 999999),
      ('ENTERPRISE_BASIC_MONTHLY'::"PlanCode", 'maxDigitalFactories', 999999),
      ('ENTERPRISE_BASIC_ANNUAL'::"PlanCode", 'maxDigitalFactories', 999999),
      ('ENTERPRISE_STANDARD_MONTHLY'::"PlanCode", 'maxDigitalFactories', 999999),
      ('ENTERPRISE_STANDARD_ANNUAL'::"PlanCode", 'maxDigitalFactories', 999999),
      ('ENTERPRISE_PRO_MONTHLY'::"PlanCode", 'maxDigitalFactories', 999999),
      ('ENTERPRISE_PRO_ANNUAL'::"PlanCode", 'maxDigitalFactories', 999999)
  ) AS v(plan_code, feature_key, limit_value)
)
INSERT INTO "entitlements" (
  "id",
  "plan_id",
  "feature_key",
  "enabled",
  "limit_value",
  "limit_unit",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p."id",
  u.feature_key,
  TRUE,
  u.limit_value,
  'count',
  NOW(),
  NOW()
FROM entitlement_updates AS u
JOIN "plans" AS p ON p."code" = u.plan_code
ON CONFLICT ("plan_id", "feature_key")
DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "limit_value" = EXCLUDED."limit_value",
  "limit_unit" = EXCLUDED."limit_unit",
  "updated_at" = NOW();
