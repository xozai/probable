import { createHash, randomBytes } from "node:crypto";

export interface InvitationToken {
  token: string;
  tokenHash: string;
}

// The plaintext token goes out in the invite link and is never persisted;
// only its hash is stored, so a database read cannot forge an accept.
export function generateInvitationToken(): InvitationToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
