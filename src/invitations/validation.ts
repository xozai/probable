const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationValidationError";
  }
}

export function validateInviteEmail(value: unknown): string {
  if (typeof value !== "string") throw new InvitationValidationError("Email is required");
  const email = value.trim();
  if (!EMAIL_PATTERN.test(email)) throw new InvitationValidationError("Enter a valid email address");
  return email;
}
