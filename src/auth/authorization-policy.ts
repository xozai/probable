export type FirmRole = "owner" | "member";

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface FirmAccess extends AuthenticatedUser {
  firmId: string;
  role: FirmRole;
}

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

export class FirmNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Firm not found");
    this.name = "FirmNotFoundError";
  }
}

export class FirmForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("Owner access required");
    this.name = "FirmForbiddenError";
  }
}

export function assertFirmOwner(
  access: Pick<FirmAccess, "role">,
): asserts access is Pick<FirmAccess, "role"> & { role: "owner" } {
  if (access.role !== "owner") throw new FirmForbiddenError();
}

export function assertFirmId(value: string): void {
  if (!isFirmId(value)) throw new FirmNotFoundError();
}

export function isFirmId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
