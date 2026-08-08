# ADR-022: Make digital employees installable across all plans

## Status
Accepted

## Date
2026-08-08

## Context

Digital employees are basic reusable work capabilities. They should be available to both
the free plan and enterprise plans. Digital factories are a stronger batch-production
capability and must continue to use their configured enterprise plan and device capacity
limits.

Historically, template visibility was controlled only by each template's
`allowedPlanCodes`. That allowed older database templates and newly created templates to
drift from the intended product rule. It also mixed the permission to install a template
with the maximum number of installed digital employees on one device.

## Decision

1. A template whose application type is `DIGITAL_EMPLOYEE` or `digital_employee` is
   installable for every supported plan, including `PERSONAL_FREE` and
   `ENTERPRISE_CUSTOM`.
2. Empty or legacy-missing application type values continue to default to digital
   employee behavior for backward compatibility.
3. A digital factory keeps its stored `allowedPlanCodes` and remains subject to the
   device's `maxDigitalFactories` capacity.
4. Digital employee installation still consumes the device's `maxRoleInstances` quota.
   Opening plan visibility does not make the employee count unlimited.
5. The server is authoritative. It normalizes digital-employee permissions when templates
   are created or updated and also normalizes legacy template responses at read time.
6. The admin-console form uses all active plans as the default for new digital employees
   and enterprise plans as the default for new digital factories.

## Consequences

- Free users can see and install all published digital employees without changing the
  commercial employee-count quota.
- Existing database templates become compatible without a destructive data rewrite.
- Digital factory permissions and capacity behavior remain unchanged.
- The server policy module is the single reusable rule for catalog, runtime, and template
  factory code paths.
