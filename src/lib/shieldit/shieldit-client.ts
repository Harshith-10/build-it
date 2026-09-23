"use client";

import { useEffect, useState, useCallback } from "react";

export const SHIELDIT_CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_SHIELDIT_CHROME_STORE_URL || "";
export const SHIELDIT_ZIP_DOWNLOAD_URL = "/downloads/shieldit.zip";

export interface ShieldItStatus {
  success: boolean;
  name?: string;
  version?: string;
  installed?: boolean;
  isLockdownActive?: boolean;
  activeExamId?: string | null;
  displayCount?: number;
  error?: string;
}

export interface ShieldItViolation {
  type: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message?: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * Send an action to the ShieldIt extension via window.postMessage bridge.
 */
export function sendShieldItMessage<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs: number = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const correlationId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let timer: NodeJS.Timeout | null = null;

    function handleMessage(event: MessageEvent) {
      if (
        event.data &&
        event.data.target === "SHIELDIT_WEB_APP" &&
        event.data.correlationId === correlationId
      ) {
        if (timer) clearTimeout(timer);
        window.removeEventListener("message", handleMessage);
        resolve(event.data as T);
      }
    }

    window.addEventListener("message", handleMessage);

    timer = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error(`ShieldIt timeout waiting for action: ${action}`));
    }, timeoutMs);

    window.postMessage(
      {
        target: "SHIELDIT_EXTENSION",
        action,
        payload,
        correlationId
      },
      "*"
    );
  });
}

/**
 * Check if the ShieldIt extension is installed and responsive.
 */
export async function checkShieldItInstalled(retries: number = 1): Promise<{
  installed: boolean;
  version?: string;
  displayCount?: number;
}> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await sendShieldItMessage<ShieldItStatus>("PING", {}, 1000);
      const isLive =
        res?.success === true && res?.installed === true && res?.name === "ShieldIt";
      if (isLive) {
        return {
          installed: true,
          version: res?.version || "1.0.1",
          displayCount: res?.displayCount
        };
      }
    } catch {
      // Ignore and retry if attempts remain
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-shieldit-installed");
  }
  return { installed: false };
}

/**
 * Start extension lockdown for an exam or lab.
 */
export async function startShieldItLockdown(
  examId: string,
  options: { allowMultipleDisplays?: boolean; sessionSecret?: string } = {}
) {
  const secret =
    options.sessionSecret ||
    `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Store in sessionStorage so it survives in-page refreshes
  if (typeof window !== "undefined") {
    sessionStorage.setItem(`shieldit_secret_${examId}`, secret);
    sessionStorage.setItem("shieldit_active_secret", secret);
  }

  return await sendShieldItMessage<{
    success: boolean;
    disabledCount?: number;
    sessionSecret?: string;
    error?: string;
    message?: string;
  }>("START_LOCKDOWN", {
    examId,
    sessionSecret: secret,
    options
  });
}

/**
 * Stop extension lockdown using the authorized session secret.
 */
export async function stopShieldItLockdown(examId?: string, sessionSecret?: string) {
  let secret = sessionSecret;
  if (!secret && typeof window !== "undefined") {
    secret =
      (examId ? sessionStorage.getItem(`shieldit_secret_${examId}`) : null) ||
      sessionStorage.getItem("shieldit_active_secret") ||
      undefined;
  }

  const res = await sendShieldItMessage<{
    success: boolean;
    restoredCount?: number;
    error?: string;
    message?: string;
  }>("STOP_LOCKDOWN", {
    sessionSecret: secret
  });

  // Immediately remove badge and clear styles from web page on unlock
  if (typeof window !== "undefined") {
    if (res?.success) {
      if (examId) sessionStorage.removeItem(`shieldit_secret_${examId}`);
      sessionStorage.removeItem("shieldit_active_secret");
    }
    const badge = document.getElementById("shieldit-status-badge");
    if (badge) badge.remove();
    document.body?.classList.remove("shieldit-lockdown-active");
  }

  return res;
}

/**
 * React Hook: useShieldIt
 * Manages extension detection, lockdown status, and violation monitoring.
 */
export function useShieldIt(examId?: string) {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(1);
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [violations, setViolations] = useState<ShieldItViolation[]>([]);

  const checkStatus = useCallback(async () => {
    const status = await checkShieldItInstalled(1);
    if (status.installed) {
      setIsInstalled(true);
      if (status.version) setExtensionVersion(status.version);
      if (status.displayCount !== undefined) setDisplayCount(status.displayCount);
    } else {
      setIsInstalled(false);
      setIsLockdownActive(false);
    }
    return status;
  }, []);

  // Check extension availability on mount & listen for live signals
  useEffect(() => {
    let isMounted = true;
    checkStatus();

    // 1. Instant CustomEvent listener when content script mounts
    const handleReady = (e: CustomEvent<{ installed: boolean; version?: string }>) => {
      if (!isMounted) return;
      setIsInstalled(true);
      if (e.detail?.version) setExtensionVersion(e.detail.version);
    };

    // 2. Background status / disconnection listener
    const handleStatusMessage = (event: MessageEvent) => {
      if (!isMounted || !event.data || event.data.target !== "SHIELDIT_WEB_APP") return;

      if (event.data.error === "EXTENSION_DISABLED" || event.data.installed === false) {
        setIsInstalled(false);
        setIsLockdownActive(false);
        setViolations((prev) => [
          ...prev,
          {
            type: "EXTENSION_DISABLED",
            severity: "CRITICAL",
            message: "ShieldIt Proctor extension was disabled or turned off.",
            timestamp: Date.now()
          }
        ]);
        return;
      }

      if (event.data.type === "SHIELDIT_VIOLATION" && event.data.violation) {
        setViolations((prev) => [...prev, event.data.violation]);
        return;
      }

      if (
        event.data.type === "SHIELDIT_STATUS_UPDATE" ||
        event.data.action === "STATUS_UPDATE" ||
        event.data.type === "SHIELDIT_READY"
      ) {
        setIsInstalled(true);
        if (event.data.version) setExtensionVersion(event.data.version);
        if (event.data.displayCount !== undefined) setDisplayCount(event.data.displayCount);
        if (event.data.isLockdownActive !== undefined) setIsLockdownActive(event.data.isLockdownActive);
      }
    };

    window.addEventListener("shieldit:ready" as unknown as keyof WindowEventMap, handleReady as EventListener);
    window.addEventListener("message", handleStatusMessage);

    // 3. Heartbeat watchdog poll (every 1.5s) to detect disabling / disconnect
    let missedPings = 0;
    const pollInterval = setInterval(() => {
      checkShieldItInstalled(0).then((status) => {
        if (!isMounted) return;
        if (status.installed) {
          missedPings = 0;
          setIsInstalled(true);
          if (status.version) setExtensionVersion(status.version);
          if (status.displayCount !== undefined) setDisplayCount(status.displayCount);
        } else {
          missedPings++;
          // If missed 2 consecutive pings (~3s), extension was disabled in browser
          if (missedPings >= 2) {
            setIsInstalled(false);
            setIsLockdownActive(false);
          }
        }
      });
    }, 1500);

    // 4. Violation listener
    const handleViolation = (event: CustomEvent<ShieldItViolation>) => {
      if (event.detail) {
        setViolations((prev) => [...prev, event.detail]);
      }
    };

    window.addEventListener(
      "shieldit:violation" as unknown as keyof WindowEventMap,
      handleViolation as EventListener
    );

    // 5. Auto-check whenever user refocuses the exam tab
    const handleFocus = () => {
      if (!isMounted) return;
      checkStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener("shieldit:ready" as unknown as keyof WindowEventMap, handleReady as EventListener);
      window.removeEventListener("message", handleStatusMessage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        "shieldit:violation" as unknown as keyof WindowEventMap,
        handleViolation as EventListener
      );
    };
  }, [checkStatus]);

  const startLockdown = useCallback(
    async (targetExamId?: string, allowMultipleDisplays: boolean = true) => {
      const activeId = targetExamId || examId || "exam_session";
      const result = await startShieldItLockdown(activeId, {
        allowMultipleDisplays
      });
      if (result.success) {
        setIsLockdownActive(true);
      }
      return result;
    },
    [examId]
  );

  const stopLockdown = useCallback(
    async (targetExamId?: string) => {
      const activeId = targetExamId || examId || "exam_session";
      const result = await stopShieldItLockdown(activeId);
      if (result.success) {
        setIsLockdownActive(false);
      }
      return result;
    },
    [examId]
  );

  return {
    isInstalled,
    extensionVersion,
    displayCount,
    isLockdownActive,
    violations,
    checkStatus,
    startLockdown,
    stopLockdown
  };
}

/**
 * Automatically ensures any in-DOM ShieldIt badge is relocated to bottom-right
 * and attaches drag handlers so students can move it anywhere on their screen.
 */
if (typeof window !== "undefined") {
  const attachBadgeDragClient = (badge: HTMLElement) => {
    if ((badge as unknown as { _shielditDragAttached?: boolean })._shielditDragAttached) return;
    (badge as unknown as { _shielditDragAttached?: boolean })._shielditDragAttached = true;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    badge.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;

      isDragging = true;
      badge.dataset.userMoved = "true";
      badge.classList.add("shieldit-dragging");
      badge.style.setProperty("cursor", "grabbing", "important");

      const rect = badge.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;

      badge.style.setProperty("bottom", "auto", "important");
      badge.style.setProperty("right", "auto", "important");
      badge.style.setProperty("left", `${origLeft}px`, "important");
      badge.style.setProperty("top", `${origTop}px`, "important");
      badge.style.setProperty("width", "fit-content", "important");
      badge.style.setProperty("max-width", "fit-content", "important");
      badge.style.setProperty("height", "auto", "important");
      badge.style.setProperty("white-space", "nowrap", "important");

      try {
        badge.setPointerCapture(e.pointerId);
      } catch (_) {}

      e.preventDefault();
      e.stopPropagation();
    });

    badge.addEventListener("pointermove", (e: PointerEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxLeft = Math.max(8, window.innerWidth - badge.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - badge.offsetHeight - 8);

      const newLeft = Math.max(8, Math.min(maxLeft, origLeft + dx));
      const newTop = Math.max(8, Math.min(maxTop, origTop + dy));

      badge.style.setProperty("left", `${newLeft}px`, "important");
      badge.style.setProperty("top", `${newTop}px`, "important");
      badge.style.setProperty("bottom", "auto", "important");
      badge.style.setProperty("right", "auto", "important");

      e.preventDefault();
      e.stopPropagation();
    });

    const stopDragging = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        badge.classList.remove("shieldit-dragging");
        badge.style.setProperty("cursor", "grab", "important");
        try {
          badge.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    badge.addEventListener("pointerup", stopDragging);
    badge.addEventListener("pointercancel", stopDragging);
  };

  const repositionBadge = () => {
    const badge = document.getElementById("shieldit-status-badge");
    if (badge) {
      attachBadgeDragClient(badge);

      badge.style.setProperty("position", "fixed", "important");
      badge.style.setProperty("z-index", "2147483647", "important");
      badge.style.setProperty("cursor", "grab", "important");
      badge.style.setProperty("user-select", "none", "important");
      badge.style.setProperty("-webkit-user-select", "none", "important");
      badge.style.setProperty("touch-action", "none", "important");
      badge.style.setProperty("width", "fit-content", "important");
      badge.style.setProperty("max-width", "fit-content", "important");
      badge.style.setProperty("height", "auto", "important");
      badge.style.setProperty("white-space", "nowrap", "important");
      badge.title = "ShieldIt Active • Drag anywhere to move";

      if (badge.dataset.userMoved !== "true" && !badge.dataset.shielditPositionFixed) {
        badge.dataset.shielditPositionFixed = "true";
        badge.style.setProperty("top", "auto", "important");
        badge.style.setProperty("left", "auto", "important");
        badge.style.setProperty("bottom", "16px", "important");
        badge.style.setProperty("right", "18px", "important");
        badge.style.setProperty("transform", "none", "important");
      }
    }
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", repositionBadge);
    } else {
      repositionBadge();
    }
    const observer = new MutationObserver(repositionBadge);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(repositionBadge, 1000);
  }
}

