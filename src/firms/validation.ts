export class FirmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmValidationError";
  }
}

export function validateFirmName(value: unknown): string {
  if (typeof value !== "string") throw new FirmValidationError("Firm name is required");
  const name = value.trim();
  if (name.length < 2 || name.length > 120) {
    throw new FirmValidationError("Firm name must be between 2 and 120 characters");
  }
  return name;
}
