import type { PlanCode } from './types/plan-code';

export const allDigitalEmployeePlanCodes: readonly PlanCode[] = [
  'PERSONAL_FREE',
  'PERSONAL_MEMBER_MONTHLY',
  'PERSONAL_MEMBER_ANNUAL',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
];

export function isDigitalFactoryApplicationType(value: unknown): boolean {
  return value === 'DIGITAL_FACTORY' || value === 'digital_factory';
}

export function isDigitalEmployeeApplicationType(value: unknown): boolean {
  return !isDigitalFactoryApplicationType(value);
}
