export function validateFirmName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Firm name is required");
  const name = value.trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error("Firm name must be between 2 and 120 characters");
  }
  return name;
}
