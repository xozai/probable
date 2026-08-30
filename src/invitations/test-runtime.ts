export interface TestInvitationMessage {
  email: string;
  url: string;
}

const runtimeKey = Symbol.for("probable.invitations.test-runtime");
const globalRuntime = globalThis as typeof globalThis & {
  [runtimeKey]?: TestInvitationMessage[];
};

export function getTestInvitationMessages(): TestInvitationMessage[] {
  if (!globalRuntime[runtimeKey]) {
    globalRuntime[runtimeKey] = [];
  }
  return globalRuntime[runtimeKey];
}
