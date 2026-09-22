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
    () => {
      if (!isExamLockdown) return;
      notifyViolation({
        type: "WINDOW_BLUR",
        severity: "HIGH",
        message: "Exam window lost focus (Alt+Tab or application switch detected)"
      });
    },
    { capture: true, signal }
  );

  // Document Visibility Guard: Detects tab hidden or minimized
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!isExamLockdown) return;
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

  function updateLockdownUI(active) {
    const isExamPage =
      window.location.pathname.includes("/session") ||
      window.location.pathname.includes("/labs") ||
      window.location.pathname.includes("test_sandbox") ||
      window.location.pathname.includes("shieldit-test");

    isExamLockdown = active && isExamPage;

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

        // Guarantee bottom-right corner positioning regardless of cached stylesheets
        badge.style.setProperty("position", "fixed", "important");
        badge.style.setProperty("bottom", "16px", "important");
        badge.style.setProperty("right", "18px", "important");
        badge.style.setProperty("top", "auto", "important");
        badge.style.setProperty("left", "auto", "important");
        badge.style.setProperty("z-index", "2147483647", "important");
        badge.style.setProperty("margin", "0", "important");
        badge.style.setProperty("transform", "none", "important");
        badge.style.setProperty("cursor", "grab", "important");
        badge.style.setProperty("user-select", "none", "important");
        badge.title = "ShieldIt Active • Drag to reposition";

        // Drag-to-reposition handler
        let isDragging = false;
        let startX, startY, origLeft, origTop;

        badge.addEventListener("mousedown", (e) => {
          isDragging = true;
          badge.style.setProperty("cursor", "grabbing", "important");
          const rect = badge.getBoundingClientRect();
          startX = e.clientX;
          startY = e.clientY;
          origLeft = rect.left;
          origTop = rect.top;

          badge.style.setProperty("bottom", "auto", "important");
          badge.style.setProperty("right", "auto", "important");
          badge.style.setProperty("width", "fit-content", "important");
          badge.style.setProperty("max-width", "fit-content", "important");
          badge.style.setProperty("height", "auto", "important");
          badge.style.setProperty("white-space", "nowrap", "important");
          badge.style.setProperty("left", `${origLeft}px`, "important");
          badge.style.setProperty("top", `${origTop}px`, "important");
          e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const newLeft = Math.max(10, Math.min(window.innerWidth - badge.offsetWidth - 10, origLeft + dx));
          const newTop = Math.max(10, Math.min(window.innerHeight - badge.offsetHeight - 10, origTop + dy));
          badge.style.setProperty("left", `${newLeft}px`, "important");
          badge.style.setProperty("top", `${newTop}px`, "important");
          badge.style.setProperty("bottom", "auto", "important");
          badge.style.setProperty("right", "auto", "important");
          badge.style.setProperty("width", "fit-content", "important");
          badge.style.setProperty("height", "auto", "important");
        }, { signal });

        window.addEventListener("mouseup", () => {
          if (isDragging) {
            isDragging = false;
            badge.style.setProperty("cursor", "grab", "important");
          }
        }, { signal });

        document.body.appendChild(badge);
      } else if (badge) {
        // Enforce bottom-right on existing badge if stylesheet had cached top-center
        badge.style.setProperty("top", "auto", "important");
        badge.style.setProperty("left", "auto", "important");
        badge.style.setProperty("bottom", "16px", "important");
        badge.style.setProperty("right", "18px", "important");
        badge.style.setProperty("transform", "none", "important");
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
