import type { Adapter } from "next-auth/adapters";
import type { EmailConfig } from "next-auth/providers";

import { createTestAdapter, type TestAuthState } from "./test-adapter";

export interface TestMessage {
  identifier: string;
  url: string;
}

interface TestRuntime {
  adapter: Adapter;
  messages: TestMessage[];
  state: TestAuthState;
}

const runtimeKey = Symbol.for("probable.auth.test-runtime");
const globalRuntime = globalThis as typeof globalThis & {
  [runtimeKey]?: TestRuntime;
};

export function getTestAuthRuntime(): TestRuntime {
  if (!globalRuntime[runtimeKey]) {
    const state: TestAuthState = {
      users: new Map(),
      verificationTokens: new Map(),
    };
    globalRuntime[runtimeKey] = {
      adapter: createTestAdapter(state),
      messages: [],
      state,
    };
  }
  return globalRuntime[runtimeKey];
}

export const sendTestMagicLink: EmailConfig["sendVerificationRequest"] = async ({
  identifier,
  url,
}) => {
  getTestAuthRuntime().messages.push({ identifier, url });
};
