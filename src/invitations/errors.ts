export class InvitationNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Invitation not found");
    this.name = "InvitationNotFoundError";
  }
}
