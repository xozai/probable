const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInviteEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Email is required");
  const email = value.trim();
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address");
  return email;
}
