export class InvitationNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Invitation not found");
    this.name = "InvitationNotFoundError";
  }
}

// The invitation row is already committed by the time this is thrown (see
// createInvitationForFirm in ./service): the token itself is never
// persisted in recoverable form, so the only way back is to revoke the
// orphaned pending invitation and try again once email delivery works.
export class InvitationEmailError extends Error {
  readonly status = 502;

  constructor(email: string, cause: unknown) {
    super(
      `Invitation saved but the email to ${email} could not be sent. Revoke it below and try again once email delivery is working.`,
    );
    this.name = "InvitationEmailError";
    this.cause = cause;
  }
}
