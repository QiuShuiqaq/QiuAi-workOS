export type RoleExecutionApplicationType = 'digital_employee' | 'digital_factory';
export type RoleExecutionMode = 'conversation' | 'watch' | 'hybrid';

export function isWatchExecutionProfile(
  profile: { mode?: RoleExecutionMode } | undefined,
  applicationType: RoleExecutionApplicationType = 'digital_employee'
): boolean {
  if (applicationType !== 'digital_employee') {
    return false;
  }

  return profile?.mode === 'watch' || profile?.mode === 'hybrid';
}

export function resolveRoleExecutionModeMeta(
  profile: { mode?: RoleExecutionMode } | undefined,
  applicationType: RoleExecutionApplicationType = 'digital_employee'
): { label: string; color: string } {
  if (applicationType === 'digital_factory') {
    return { label: '批量生产式', color: 'cyan' };
  }

  return isWatchExecutionProfile(profile, applicationType)
    ? { label: '值守式', color: 'gold' }
    : { label: '对话式', color: 'blue' };
}
