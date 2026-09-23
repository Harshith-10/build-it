/**
 * ShieldIt - Content Script
 * Injected into BuildIt web pages to enforce in-page keyboard/mouse guards
 * and provide a seamless window.postMessage bridge.
 */

(function () {
  "use strict";

  // Helper to check if extension context is still alive
  function isExtensionValid() {
    try {
      return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
    } catch {
      return false;
    }
  }

  // Clean up any previously active content script instance in this tab
  if (typeof window.__shieldit_cleanup === "function") {
    try {
      window.__shieldit_cleanup();
    } catch (e) {}
  }

  const abortController = new AbortController();
  const { signal } = abortController;

  const handleRuntimeMessage = (message) => {
    if (message?.source === "SHIELDIT_EXTENSION") {
      if (message.type === "LOCKDOWN_STARTED") {
        updateLockdownUI(true);
      } else if (message.type === "LOCKDOWN_STOPPED") {
        updateLockdownUI(false);
      } else if (message.type === "VIOLATION") {
        window.dispatchEvent(
          new CustomEvent("shieldit:violation", { detail: message.violation })
        );
        window.postMessage(
          {
            target: "SHIELDIT_WEB_APP",
            type: "SHIELDIT_VIOLATION",
            violation: message.violation
          },
          "*"
        );
      }
    }
  };

  if (isExtensionValid()) {
    try {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    } catch (e) {}
  }

  window.__shieldit_cleanup = () => {
    try {
      abortController.abort();
    } catch (e) {}
    if (isExtensionValid()) {
      try {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      } catch (e) {}
    }
  };

  // Synchronously stamp DOM so web apps can detect ShieldIt instantly with 0ms latency
  try {
    document.documentElement.setAttribute("data-shieldit-installed", "true");
    document.documentElement.setAttribute("data-shieldit-version", "1.0.1");
    window.dispatchEvent(
      new CustomEvent("shieldit:ready", {
        detail: { installed: true, version: "1.0.1", name: "ShieldIt" }
      })
    );
    window.postMessage(
      {
        target: "SHIELDIT_WEB_APP",
        type: "SHIELDIT_READY",
        installed: true,
        version: "1.0.1"
      },
      "*"
    );
  } catch (e) {}

  let isExamLockdown = false;
  const pageLoadTimestamp = Date.now();
  let lockdownActivatedTime = 0;
  const GRACE_PERIOD_MS = 4000;
  let lastBlurViolationTime = 0;

  // ----------------------------------------------------------------------
  // 1. FORBIDDEN SHORTCUTS & INPUT GUARDS
  // ----------------------------------------------------------------------

  const FORBIDDEN_KEYS = [
    // Developer tools
    { key: "F12" },
    { ctrlKey: true, shiftKey: true, key: "I" },
    { ctrlKey: true, shiftKey: true, key: "i" },
    { ctrlKey: true, shiftKey: true, key: "J" },
    { ctrlKey: true, shiftKey: true, key: "j" },
    { ctrlKey: true, shiftKey: true, key: "C" },
    { ctrlKey: true, shiftKey: true, key: "c" },
    // View source / Print / Save
    { ctrlKey: true, key: "u" },
    { ctrlKey: true, key: "U" },
    { ctrlKey: true, key: "p" },
    { ctrlKey: true, key: "P" },
    { ctrlKey: true, key: "s" },
    { ctrlKey: true, key: "S" },
    // AI Copilot extensions (e.g. Monica, Merlin)
    { altKey: true, key: "m" },
    { altKey: true, key: "M" },
    { altKey: true, key: "a" },
    { altKey: true, key: "A" }
  ];

  function isForbiddenKey(e) {
    if (!e || typeof e.key !== "string") return false;
    const pressedKey = e.key.toLowerCase();
    return FORBIDDEN_KEYS.some((combo) => {
      return (
        (combo.key ? pressedKey === combo.key.toLowerCase() : true) &&
        (combo.ctrlKey !== undefined ? e.ctrlKey === combo.ctrlKey : true) &&
        (combo.shiftKey !== undefined ? e.shiftKey === combo.shiftKey : true) &&
        (combo.altKey !== undefined ? e.altKey === combo.altKey : true)
      );
    });
  }

  // Intercept keys at the root capture phase
  window.addEventListener(
    "keydown",
    (e) => {
      if (!isExamLockdown) return;

      // Detect Alt+Tab, Windows key (Meta), or Ctrl+Tab shortcut attempts
      if (
        (e.altKey && (e.key === "Tab" || e.code === "Tab")) ||
        (e.ctrlKey && (e.key === "Tab" || e.code === "Tab")) ||
        e.key === "Meta" ||
        e.key === "OS"
      ) {
        notifyViolation({
          type: "WINDOW_BLUR",
          severity: "HIGH",
          message: "Application switch shortcut detected (Alt+Tab / Meta)"
        });
      }

      if (isForbiddenKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const keyName = e.key || "Unknown";
        notifyViolation({
          type: "BLOCKED_KEY_PRESS",
          key: keyName,
          message: `Restricted shortcut blocked: ${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.altKey ? "Alt+" : ""}${keyName}`
        });
        return false;
      }
    },
    { capture: true, signal }
  );

  // Window Blur Guard: Detects Alt+Tab, switching to another app, minimizing, or clicking outside
  window.addEventListener(
    "blur",
    (e) => {
      if (!isExamLockdown) return;

      // 1. Ignore if focus is just shifting between internal DOM elements (inputs, buttons, modal, Monaco editor)
      if (e.target && e.target !== window && e.target !== document) {
        return;
      }

      // 2. Suppress blurs during initial startup & page navigation grace period (first 4 seconds)
      if (
        Date.now() - pageLoadTimestamp < GRACE_PERIOD_MS ||
        Date.now() - lockdownActivatedTime < GRACE_PERIOD_MS
      ) {
        return;
      }

      // 3. Debounce window blur to prevent duplicate strikes
      const now = Date.now();
      if (now - lastBlurViolationTime < 2500) {
        return;
      }

      // 4. Give the browser 180ms to settle: if document STILL has focus, ignore internal focus transitions
      setTimeout(() => {
        if (!isExamLockdown) return;
        if (document.hasFocus()) {
          return;
        }
        if (
          Date.now() - pageLoadTimestamp < GRACE_PERIOD_MS ||
          Date.now() - lockdownActivatedTime < GRACE_PERIOD_MS
        ) {
          return;
        }

        lastBlurViolationTime = Date.now();
        notifyViolation({
          type: "WINDOW_BLUR",
          severity: "HIGH",
          message: "Exam window lost focus (Alt+Tab or application switch detected)"
        });
      }, 180);
    },
    { capture: true, signal }
  );

  // Document Visibility Guard: Detects tab hidden or minimized
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!isExamLockdown) return;
      if (
        Date.now() - pageLoadTimestamp < GRACE_PERIOD_MS ||
        Date.now() - lockdownActivatedTime < GRACE_PERIOD_MS
      ) {
        return;
      }
      if (document.hidden) {
        notifyViolation({
          type: "TAB_SWITCH",
          severity: "HIGH",
          message: "Exam tab minimized or hidden"
        });
      }
    },
    { capture: true, signal }
  );

  // Block Right-Click Context Menu
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (!isExamLockdown) return;
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    { capture: true, signal }
  );

  // Block Copy / Cut / Paste inside locked exam container
  window.addEventListener(
    "copy",
    (e) => {
      if (!isExamLockdown) return;
      e.preventDefault();
      notifyViolation({ type: "CLIPBOARD_COPY_ATTEMPT", message: "Copying text is restricted during exams." });
    },
    { capture: true, signal }
  );

  window.addEventListener(
    "cut",
    (e) => {
      if (!isExamLockdown) return;
      e.preventDefault();
    },
    { capture: true, signal }
  );

  // ----------------------------------------------------------------------
  // 2. STATUS BADGE / PILL
  // ----------------------------------------------------------------------

  function attachBadgeDrag(badge) {
    if (!badge || badge._shielditDragAttached) return;
    badge._shielditDragAttached = true;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    badge.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; // Only primary mouse button or touch

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

    badge.addEventListener("pointermove", (e) => {
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

    const stopDragging = (e) => {
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
  }

  function updateLockdownUI(active) {
    const isExamPage =
      window.location.pathname.includes("/session") ||
      window.location.pathname.includes("/labs") ||
      window.location.pathname.includes("test_sandbox") ||
      window.location.pathname.includes("shieldit-test");

    const willBeLockdown = active && isExamPage;
    if (willBeLockdown && !isExamLockdown) {
      lockdownActivatedTime = Date.now();
    }
    isExamLockdown = willBeLockdown;

    // If called early at document_start before body is ready, wait for body
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => updateLockdownUI(active), { once: true });
      return;
    }

    let badge = document.getElementById("shieldit-status-badge");

    if (active && isExamPage) {
      if (document.body) {
        document.body.classList.add("shieldit-lockdown-active");
      }
      if (!badge && document.body) {
        badge = document.createElement("div");
        badge.id = "shieldit-status-badge";
        badge.innerHTML = `
          <span class="shieldit-indicator"></span>
          <span class="shieldit-text">ShieldIt Active &bull; Exam Protected</span>
        `;

        badge.style.setProperty("position", "fixed", "important");
        badge.style.setProperty("z-index", "2147483647", "important");
        badge.style.setProperty("margin", "0", "important");
        badge.style.setProperty("cursor", "grab", "important");
        badge.style.setProperty("user-select", "none", "important");
        badge.style.setProperty("-webkit-user-select", "none", "important");
        badge.style.setProperty("touch-action", "none", "important");
        badge.style.setProperty("width", "fit-content", "important");
        badge.style.setProperty("max-width", "fit-content", "important");
        badge.style.setProperty("height", "auto", "important");
        badge.style.setProperty("white-space", "nowrap", "important");
        badge.title = "ShieldIt Active • Drag anywhere to move";

        attachBadgeDrag(badge);
        document.body.appendChild(badge);
      } else if (badge) {
        attachBadgeDrag(badge);
        // Only position at bottom-right if student hasn't dragged it
        if (badge.dataset.userMoved !== "true") {
          badge.style.setProperty("top", "auto", "important");
          badge.style.setProperty("left", "auto", "important");
          badge.style.setProperty("bottom", "16px", "important");
          badge.style.setProperty("right", "18px", "important");
          badge.style.setProperty("transform", "none", "important");
        }
      }
    } else {
      if (document.body) {
        document.body.classList.remove("shieldit-lockdown-active");
      }
      if (badge) {
        badge.remove();
      }
    }
  }

  // ----------------------------------------------------------------------
  // 3. WINDOW MESSAGE BRIDGE (Web Page <-> Content Script <-> Service Worker)
  // ----------------------------------------------------------------------

  window.addEventListener(
    "message",
    (event) => {
      // Only accept messages intended for ShieldIt
      if (!event.data || event.data.target !== "SHIELDIT_EXTENSION") return;

      const { action, payload, correlationId } = event.data;

      // If extension was disabled in chrome://extensions, cleanly detach this instance and notify web app
      if (!isExtensionValid()) {
        try {
          abortController.abort();
        } catch {}

        try {
          document.documentElement.removeAttribute("data-shieldit-installed");
          document.documentElement.removeAttribute("data-shieldit-version");
          const badge = document.getElementById("shieldit-status-badge");
          if (badge) badge.remove();
          document.body?.classList.remove("shieldit-lockdown-active");
        } catch {}

        window.postMessage(
          {
            target: "SHIELDIT_WEB_APP",
            correlationId,
            action,
            success: false,
            installed: false,
            error: "EXTENSION_DISABLED",
            message: "ShieldIt extension is disabled or context was invalidated."
          },
          "*"
        );
        return;
      }

      // Fast-path: Answer PING immediately from content script for 0ms instant detection!
      if (action === "PING" || action === "HANDSHAKE") {
        window.postMessage(
          {
            target: "SHIELDIT_WEB_APP",
            correlationId,
            action,
            success: true,
            name: "ShieldIt",
            version: "1.0.1",
            installed: true
          },
          "*"
        );

        // Asynchronously query background worker to sync display count and lockdown status
        if (isExtensionValid()) {
          try {
            chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
              if (chrome.runtime.lastError) return;
              if (response) {
                if (response.isLockdownActive) {
                  updateLockdownUI(true);
                }
                window.postMessage(
                  {
                    target: "SHIELDIT_WEB_APP",
                    type: "SHIELDIT_STATUS_UPDATE",
                    ...response
                  },
                  "*"
                );
              }
            });
          } catch {}
        }
        return;
      }

      // Forward all other commands (START_LOCKDOWN, STOP_LOCKDOWN, etc.) to background worker
      try {
        chrome.runtime.sendMessage({ action, payload }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                target: "SHIELDIT_WEB_APP",
                correlationId,
                success: false,
                error: chrome.runtime.lastError.message
              },
              "*"
            );
            return;
          }

          if (action === "START_LOCKDOWN" && response?.success) {
            updateLockdownUI(true);
          } else if (action === "STOP_LOCKDOWN" && response?.success) {
            updateLockdownUI(false);
          }

          // Respond back to web page
          window.postMessage(
            {
              target: "SHIELDIT_WEB_APP",
              correlationId,
              action,
              ...response
            },
            "*"
          );
        });
      } catch (err) {
        window.postMessage(
          {
            target: "SHIELDIT_WEB_APP",
            correlationId,
            success: false,
            error: err?.message || "Extension communication failed"
          },
          "*"
        );
      }
    },
    { signal }
  );

  function notifyViolation(detail) {
    const fullDetail = { ...detail, timestamp: Date.now() };

    window.dispatchEvent(
      new CustomEvent("shieldit:violation", { detail: fullDetail })
    );

    window.postMessage(
      {
        target: "SHIELDIT_WEB_APP",
        type: "SHIELDIT_VIOLATION",
        violation: fullDetail
      },
      "*"
    );

    if (isExtensionValid()) {
      try {
        chrome.runtime.sendMessage({
          action: "REPORT_VIOLATION",
          payload: fullDetail
        }).catch(() => {});
      } catch (e) {}
    }
  }

  // Check initial state on page load or when injected into an existing tab
  if (isExtensionValid()) {
    try {
      chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.isLockdownActive) {
          updateLockdownUI(true);
        }
        window.postMessage(
          {
            target: "SHIELDIT_WEB_APP",
            type: "SHIELDIT_STATUS_UPDATE",
            installed: true,
            isLockdownActive: !!response?.isLockdownActive,
            displayCount: response?.displayCount,
            version: "1.0.1"
          },
          "*"
        );
      });
    } catch {}
  }
})();
