export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseAllowedEmails(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowedEmails: ReadonlySet<string>,
): boolean {
  return Boolean(email && allowedEmails.has(normalizeEmail(email)));
}
