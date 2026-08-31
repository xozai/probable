"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Renders nothing. A server component reads a one-shot flash value (e.g.
// ?invited= or ?error=) out of searchParams and renders it once on the
// initial response; this then strips the query string from the browser URL
// so the flash value doesn't sit in history/bookmarks after that first paint.
// Uses the native History API (which Next syncs with) rather than
// router.replace: a router navigation refetches the page without the query
// param, which would blank the flash — including the show-once invite link —
// right after it renders.
export function FlashCleanup({ active }: { active: boolean }) {
  const pathname = usePathname();
  const cleaned = useRef(false);

  useEffect(() => {
    if (active && !cleaned.current) {
      cleaned.current = true;
      window.history.replaceState(null, "", pathname);
    }
  }, [active, pathname]);

  return null;
}
