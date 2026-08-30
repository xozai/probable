import type {
  Adapter,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";

import { normalizeEmail } from "./email-policy";

export interface TestAuthState {
  users: Map<string, AdapterUser>;
  verificationTokens: Map<string, VerificationToken>;
}

function tokenKey(identifier: string, token: string): string {
  return `${normalizeEmail(identifier)}:${token}`;
}

export function createTestAdapter(
  state: TestAuthState = {
    users: new Map(),
    verificationTokens: new Map(),
  },
): Adapter {
  return {
    async createUser(user) {
      const normalized = normalizeEmail(user.email);
      const created = { ...user, email: normalized };
      state.users.set(created.id, created);
      return created;
    },
    async getUser(id) {
      return state.users.get(id) ?? null;
    },
    async getUserByEmail(email) {
      const normalized = normalizeEmail(email);
      return (
        [...state.users.values()].find((user) => user.email === normalized) ?? null
      );
    },
    async updateUser(update) {
      const current = state.users.get(update.id);
      if (!current) throw new Error(`Unknown test user: ${update.id}`);
      const updated = {
        ...current,
        ...update,
        email: normalizeEmail(update.email ?? current.email),
      };
      state.users.set(updated.id, updated);
      return updated;
    },
    async createVerificationToken(verificationToken) {
      const stored = {
        ...verificationToken,
        identifier: normalizeEmail(verificationToken.identifier),
      };
      state.verificationTokens.set(
        tokenKey(stored.identifier, stored.token),
        stored,
      );
      return stored;
    },
    async useVerificationToken({ identifier, token }) {
      const key = tokenKey(identifier, token);
      const stored = state.verificationTokens.get(key) ?? null;
      state.verificationTokens.delete(key);
      return stored;
    },
  };
}
