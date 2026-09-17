"use client";

import { useEffect, useState, useCallback } from "react";

export const SHIELDIT_CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_SHIELDIT_CHROME_STORE_URL || "";
export const SHIELDIT_ZIP_DOWNLOAD_URL = "/downloads/shieldit.zip";

export interface ShieldItStatus {
  success: boolean;
  name?: string;
  version?: string;
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
export async function checkShieldItInstalled(): Promise<{
  installed: boolean;
  version?: string;
  displayCount?: number;
}> {
  // 1. Instant Synchronous Check: content script stamps DOM attribute immediately
  if (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-shieldit-installed") === "true"
  ) {
    const version =
      document.documentElement.getAttribute("data-shieldit-version") || "1.0.1";
    return {
      installed: true,
      version
    };
  }

  // 2. PostMessage Bridge Check with reliable timeout
  try {
    const res = await sendShieldItMessage<ShieldItStatus>("PING", {}, 2500);
    return {
      installed: res?.success === true && res?.name === "ShieldIt",
      version: res?.version || "1.0.1",
      displayCount: res?.displayCount
    };
  } catch {
    return { installed: false };
  }
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
  const [isInstalled, setIsInstalled] = useState<boolean | null>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-shieldit-installed") === "true";
    }
    return null;
  });
  const [extensionVersion, setExtensionVersion] = useState<string | null>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-shieldit-version");
    }
    return null;
  });
  const [displayCount, setDisplayCount] = useState<number>(1);
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [violations, setViolations] = useState<ShieldItViolation[]>([]);

  const checkStatus = useCallback(async () => {
    // Check DOM first
    if (
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-shieldit-installed") === "true"
    ) {
      setIsInstalled(true);
      setExtensionVersion(
        document.documentElement.getAttribute("data-shieldit-version") || "1.0.1"
      );
    }
    const status = await checkShieldItInstalled();
    if (status.installed) {
      setIsInstalled(true);
      if (status.version) setExtensionVersion(status.version);
      if (status.displayCount !== undefined) setDisplayCount(status.displayCount);
    } else if (isInstalled === null) {
      setIsInstalled(false);
    }
    return status;
  }, [isInstalled]);

  // Check extension availability on mount & listen for instant ready signal
  useEffect(() => {
    let isMounted = true;
    checkStatus();

    // 1. Instant CustomEvent listener when content script mounts
    const handleReady = (e: CustomEvent<{ installed: boolean; version?: string }>) => {
      if (!isMounted) return;
      setIsInstalled(true);
      if (e.detail?.version) setExtensionVersion(e.detail.version);
    };

    // 2. Background status update listener
    const handleStatusMessage = (event: MessageEvent) => {
      if (!isMounted || !event.data || event.data.target !== "SHIELDIT_WEB_APP") return;
      if (event.data.type === "SHIELDIT_STATUS_UPDATE" || event.data.action === "STATUS_UPDATE") {
        setIsInstalled(true);
        if (event.data.displayCount !== undefined) setDisplayCount(event.data.displayCount);
        if (event.data.isLockdownActive !== undefined) setIsLockdownActive(event.data.isLockdownActive);
      }
    };

    window.addEventListener("shieldit:ready" as unknown as keyof WindowEventMap, handleReady as EventListener);
    window.addEventListener("message", handleStatusMessage);

    // 3. Fast auto-poll (every 1 second) until extension is detected
    const pollInterval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-shieldit-installed") === "true"
      ) {
        setIsInstalled(true);
      }
      checkShieldItInstalled().then((status) => {
        if (!isMounted) return;
        if (status.installed) {
          setIsInstalled(true);
          if (status.version) setExtensionVersion(status.version);
          if (status.displayCount !== undefined) setDisplayCount(status.displayCount);
        }
      });
    }, 1000);

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

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener("shieldit:ready" as unknown as keyof WindowEventMap, handleReady as EventListener);
      window.removeEventListener("message", handleStatusMessage);
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
  const repositionBadge = () => {
    const badge = document.getElementById("shieldit-status-badge");
    if (badge && !badge.dataset.shielditPositionFixed) {
      badge.dataset.shielditPositionFixed = "true";
      badge.style.setProperty("top", "auto", "important");
      badge.style.setProperty("left", "auto", "important");
      badge.style.setProperty("bottom", "16px", "important");
      badge.style.setProperty("right", "18px", "important");
      badge.style.setProperty("transform", "none", "important");
      badge.style.setProperty("z-index", "2147483647", "important");
      badge.style.setProperty("cursor", "grab", "important");
      badge.title = "ShieldIt Active • Drag to reposition";

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let origX = 0;
      let origY = 0;

      badge.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = badge.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        badge.style.setProperty("bottom", "auto", "important");
        badge.style.setProperty("right", "auto", "important");
        badge.style.setProperty("left", `${origX}px`, "important");
        badge.style.setProperty("top", `${origY}px`, "important");
        badge.style.setProperty("cursor", "grabbing", "important");
        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - badge.offsetWidth - 10, origX + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - badge.offsetHeight - 10, origY + dy));
        badge.style.setProperty("left", `${newLeft}px`, "important");
        badge.style.setProperty("top", `${newTop}px`, "important");
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          badge.style.setProperty("cursor", "grab", "important");
        }
      });
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
    setInterval(repositionBadge, 500);
  }
}

