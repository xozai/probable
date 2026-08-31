"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Renders nothing. A server component reads a one-shot flash value (e.g.
// ?invited= or ?error=) out of searchParams and renders it once on the
// initial response; this then strips the query string from the browser URL
// so the flash value doesn't sit in history/bookmarks after that first paint.
export function FlashCleanup({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const cleaned = useRef(false);

  useEffect(() => {
    if (active && !cleaned.current) {
      cleaned.current = true;
      router.replace(pathname, { scroll: false });
    }
  }, [active, pathname, router]);

  return null;
}
