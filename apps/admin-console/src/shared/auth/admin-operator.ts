export function isAdminOperatorEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  const configuredEmails = process.env.ADMIN_CONSOLE_OPERATOR_EMAILS;
  const fallbackEmail = process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@qiuai.local';
  const source = configuredEmails?.trim() ? configuredEmails : fallbackEmail;
  const normalizedEmail = email.trim().toLowerCase();

  return source
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
