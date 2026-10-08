"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordVisit } from "@/actions/admin/analytics";

const DEBOUNCE_WINDOW_MS = 60_000; // 1 minute window per path

export function VisitTracker() {
  const pathname = usePathname();
  const lastRecordedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!pathname) return;

    // Ignore api routes or internal paths if any
    if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
      return;
    }

    const now = Date.now();
    const lastTime = lastRecordedRef.current.get(pathname) || 0;

    if (now - lastTime < DEBOUNCE_WINDOW_MS) {
      return;
    }

    lastRecordedRef.current.set(pathname, now);

    // Clean up old entries from map
    if (lastRecordedRef.current.size > 50) {
      for (const [path, time] of lastRecordedRef.current.entries()) {
        if (now - time > DEBOUNCE_WINDOW_MS * 2) {
          lastRecordedRef.current.delete(path);
        }
      }
    }

    // Fire non-blocking visit logging
    try {
      recordVisit({
        path: pathname,
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
      }).catch(() => {
        // Silently ignore telemetry failure
      });
    } catch {
      // Silently ignore telemetry failure
    }
  }, [pathname]);

  return null;
}
