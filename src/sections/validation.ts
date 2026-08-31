export class SectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionValidationError";
  }
}

export function validateSectionNames(input: readonly string[]): string[] {
  if (input.length === 0) throw new SectionValidationError("Add at least one section");
  if (input.length > 20) throw new SectionValidationError("A firm can have at most 20 sections");

  const normalized = input.map((name) => name.trim());
  if (normalized.some((name) => !name)) {
    throw new SectionValidationError("Section names cannot be blank");
  }
  if (normalized.some((name) => name.length > 80)) {
    throw new SectionValidationError("Section names must be 80 characters or fewer");
  }
  const uniqueNames = new Set(normalized.map((name) => name.toLocaleLowerCase()));
  if (uniqueNames.size !== normalized.length) {
    throw new SectionValidationError("Section names must be unique");
  }
  return normalized;
}
