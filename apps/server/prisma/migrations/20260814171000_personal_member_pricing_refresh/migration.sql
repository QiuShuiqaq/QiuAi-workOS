UPDATE "plans" AS p
SET
  "price_cents" = v.price_cents,
  "updated_at" = NOW()
FROM (
  VALUES
    ('PERSONAL_MEMBER_MONTHLY'::"PlanCode", 3000),
    ('PERSONAL_MEMBER_ANNUAL'::"PlanCode", 30000)
) AS v(code, price_cents)
WHERE p."code" = v.code;
