// Shared one-shot ?error= flash used by server actions that redirect back to
// a plain <form action={...}> page instead of returning state (see #33 item
// 1). The message is only ever rendered as text (React escapes it), so no
// sanitization beyond the URL encoding here is required.
export function withErrorFlash(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}
