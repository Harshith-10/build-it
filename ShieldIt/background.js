/**
 * ShieldIt - Background Service Worker (Manifest V3)
 * Handles extension lockdown, tab monitoring, display guards, and anti-tampering.
 */

const STORAGE_KEYS = {
  DISABLED_EXTENSIONS: "shieldit_disabled_extensions",
  LOCKDOWN_STATE: "shieldit_lockdown_state",
  ACTIVE_EXAM: "shieldit_active_exam",
  EXAM_TAB_ID: "shieldit_exam_tab_id",
  SESSION_SECRET: "shieldit_session_secret"
};

// In-memory state cache
let state = {
  isLockdownActive: false,
  activeExamId: null,
  examTabId: null,
  disabledExtensions: [],
  sessionSecret: null
};

let isRestoring = false;

// Restore state on service worker startup
let initPromise = null;
async function initServiceWorker() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.LOCKDOWN_STATE,
      STORAGE_KEYS.ACTIVE_EXAM,
      STORAGE_KEYS.EXAM_TAB_ID,
      STORAGE_KEYS.DISABLED_EXTENSIONS,
      STORAGE_KEYS.SESSION_SECRET
    ]);

    state.isLockdownActive = !!data[STORAGE_KEYS.LOCKDOWN_STATE];
    state.activeExamId = data[STORAGE_KEYS.ACTIVE_EXAM] || null;
    state.examTabId = data[STORAGE_KEYS.EXAM_TAB_ID] || null;
    state.disabledExtensions = data[STORAGE_KEYS.DISABLED_EXTENSIONS] || [];
    state.sessionSecret = data[STORAGE_KEYS.SESSION_SECRET] || null;

    console.log("[ShieldIt] Service worker initialized. Active:", state.isLockdownActive, "Secret loaded:", !!state.sessionSecret);
  } catch (err) {
    console.error("[ShieldIt] Failed to initialize state:", err);
  }
}

initPromise = initServiceWorker();

// Auto-inject content scripts and styles into open BuildIt tabs upon extension install or reload
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[ShieldIt] Extension installed/reloaded. Scanning for existing BuildIt tabs...");
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.id &&
        tab.url &&
        (tab.url.includes("localhost") ||
         tab.url.includes("127.0.0.1") ||
         tab.url.includes("build-it") ||
         tab.url.includes("buildit"))
      ) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["content.css"]
          });
          console.log(`[ShieldIt] Auto-injected into existing tab ${tab.id}: ${tab.url}`);
        } catch (err) {
          // Tab might already have the script running or is restricted
        }
      }
    }
  } catch (err) {
    console.error("[ShieldIt] Error during tab auto-injection:", err);
  }
});

// Save state to chrome.storage
async function persistState() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LOCKDOWN_STATE]: state.isLockdownActive,
    [STORAGE_KEYS.ACTIVE_EXAM]: state.activeExamId,
    [STORAGE_KEYS.EXAM_TAB_ID]: state.examTabId,
    [STORAGE_KEYS.DISABLED_EXTENSIONS]: state.disabledExtensions,
    [STORAGE_KEYS.SESSION_SECRET]: state.sessionSecret
  });
}

/**
 * Get connected displays
 */
async function getConnectedDisplays() {
  if (chrome.system && chrome.system.display) {
    return await chrome.system.display.getInfo();
  }
  return [];
}

/**
 * Start Exam Lockdown:
 * 1. Queries all extensions
 * 2. Records active non-self extensions
 * 3. Disables all other extensions
 * 4. Activates tab/display guards
 */
async function startLockdown(examId, tabId, options = {}, sessionSecret = null) {
  try {
    console.log(`[ShieldIt] Starting lockdown for exam: ${examId}, tab: ${tabId}, options:`, options);

    // Guard: If lockdown is already active and we already have a snapshot, do not overwrite it!
    if (state.isLockdownActive && state.disabledExtensions && state.disabledExtensions.length > 0) {
      console.log("[ShieldIt] Lockdown already active. Preserving current pre-exam snapshot.");
      return {
        success: true,
        disabledCount: state.disabledExtensions.length,
        examId: state.activeExamId,
        sessionSecret: state.sessionSecret,
        alreadyActive: true
      };
    }

    // Check display count
    const displays = await getConnectedDisplays();
    console.log(`[ShieldIt] Connected displays: ${displays.length}`);
    if (displays.length > 1 && !options.allowMultipleDisplays) {
      console.warn(`[ShieldIt] Dual monitors detected: ${displays.length}. Lockdown blocked.`);
      return {
        success: false,
        error: "DUAL_MONITOR_DETECTED",
        message: `Detected ${displays.length} displays. Please disconnect secondary monitors before starting. (Or enable test mode)`,
        displayCount: displays.length
      };
    }

    // Query all extensions
    const allExtensions = await chrome.management.getAll();
    const selfId = chrome.runtime.id;

    // Filter ONLY third-party extensions that are CURRENTLY ENABLED
    // (Preserve whichever extensions were already disabled by the user!)
    const extensionsToDisable = allExtensions
      .filter((ext) => ext.id !== selfId && ext.enabled && ext.type !== "theme" && ext.mayDisable !== false)
      .map((ext) => ({ id: ext.id, name: ext.name }));

    console.log(`[ShieldIt] Preserving pre-exam state: ${extensionsToDisable.length} enabled extensions will be paused:`, extensionsToDisable.map((e) => e.name));

    const disabledIds = extensionsToDisable.map((e) => e.id);
    const disabledNames = extensionsToDisable.map((e) => e.name);

    // Generate or use provided session secret
    const activeSecret = sessionSecret || options?.sessionSecret || ("sec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9));

    // Persist snapshot BEFORE disabling
    state.isLockdownActive = true;
    state.activeExamId = examId;
    state.examTabId = tabId || null;
    state.disabledExtensions = disabledIds;
    state.sessionSecret = activeSecret;
    await persistState();

    // Cumulative backup in storage so we never lose paused extensions across sessions
    const histData = await chrome.storage.local.get("shieldit_all_paused_history");
    const existingHist = histData["shieldit_all_paused_history"] || [];
    const updatedHist = Array.from(new Set([...existingHist, ...disabledIds]));
    await chrome.storage.local.set({ shieldit_all_paused_history: updatedHist });

    // Now disable each extension
    for (const ext of extensionsToDisable) {
      try {
        await chrome.management.setEnabled(ext.id, false);
        console.log(`[ShieldIt] Successfully disabled: ${ext.name} (${ext.id})`);
      } catch (err) {
        console.warn(`[ShieldIt] Could not disable ${ext.name} (${ext.id}):`, err);
      }
    }

    console.log(`[ShieldIt] Lockdown active. Successfully paused ${disabledIds.length} extensions.`);

    return {
      success: true,
      disabledCount: disabledIds.length,
      disabledNames,
      displayCount: displays.length,
      examId,
      sessionSecret: activeSecret
    };
  } catch (err) {
    console.error("[ShieldIt] Error starting lockdown:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Stop Exam Lockdown & Restore Extensions:
 * Validates session secret to prevent students from faking unlock commands.
 * Re-enables ONLY the extensions that were active before the exam.
 */
async function stopLockdown(forceAll = false, providedSecret = null) {
  try {
    console.log(`[ShieldIt v1.0.1] Stop lockdown request: forceAll=${forceAll}, providedSecret=${providedSecret}, storedSecret=${state.sessionSecret}, isLockdownActive=${state.isLockdownActive}`);

    // Anti-tamper check: If lockdown is active, verify authorization
    if (state.isLockdownActive) {
      if (forceAll) {
        // Emergency button clicked while exam is active
        console.warn("[ShieldIt] Blocked emergency restore during active exam.");
        return {
          success: false,
          error: "EXAM_IN_PROGRESS",
          message: "Cannot restore extensions while an examination is active. Complete and submit the exam first."
        };
      }

      // STRICT CHECK: An active exam MUST be unlocked with the matching sessionSecret!
      if (!providedSecret || !state.sessionSecret || providedSecret !== state.sessionSecret) {
        console.warn("[ShieldIt VIOLATION] Unauthorized attempt to unlock exam without valid sessionSecret!", {
          provided: providedSecret,
          expected: state.sessionSecret ? "[PROTECTED]" : "NONE"
        });
        sendViolationToExamTab({
          type: "SECURITY_TAMPERING",
          severity: "CRITICAL",
          message: "Unauthorized attempt to terminate lockdown without valid session token."
        });
        return {
          success: false,
          error: "INVALID_SECRET",
          message: "Unauthorized unlock attempt. Valid session token required."
        };
      }
    } else if (!forceAll) {
      console.log("[ShieldIt] Stop lockdown called but no exam is currently active.");
      return {
        success: false,
        error: "NO_ACTIVE_LOCKDOWN",
        message: "No exam lockdown is currently active."
      };
    }

    // 1. Immediately signal that lockdown is ended and restore is in progress
    isRestoring = true;
    state.isLockdownActive = false;
    await persistState();

    // 2. Fetch the pre-exam snapshot and cumulative history
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.DISABLED_EXTENSIONS,
      "shieldit_all_paused_history"
    ]);
    let toRestore = (data[STORAGE_KEYS.DISABLED_EXTENSIONS] && data[STORAGE_KEYS.DISABLED_EXTENSIONS].length > 0)
      ? data[STORAGE_KEYS.DISABLED_EXTENSIONS]
      : state.disabledExtensions || [];

    const historyPaused = data["shieldit_all_paused_history"] || [];
    toRestore = Array.from(new Set([...toRestore, ...historyPaused]));

    // Fallback: If toRestore is empty OR forceAll is true, scan all third-party disabled extensions!
    if (forceAll || toRestore.length === 0) {
      console.log("[ShieldIt] Scanning all currently disabled extensions to restore...");
      const allExts = await chrome.management.getAll();
      const selfId = chrome.runtime.id;
      const currentlyDisabled = allExts
        .filter((ext) => ext.id !== selfId && !ext.enabled && ext.type !== "theme" && ext.mayDisable !== false)
        .map((ext) => ext.id);
      toRestore = Array.from(new Set([...toRestore, ...currentlyDisabled]));
    }

    console.log(`[ShieldIt] Restoring ${toRestore.length} extensions...`);

    let restoredCount = 0;
    for (const id of toRestore) {
      try {
        await chrome.management.setEnabled(id, true);
        restoredCount++;
        console.log(`[ShieldIt] Re-enabled extension: ${id}`);
      } catch (err) {
        console.warn(`[ShieldIt] Failed to re-enable extension ${id}:`, err);
      }
    }

    // Reset state & storage
    state.activeExamId = null;
    state.examTabId = null;
    state.disabledExtensions = [];
    state.sessionSecret = null;
    await chrome.storage.local.remove("shieldit_all_paused_history");
    await persistState();

    // Settle delay before re-enabling anti-tamper check
    setTimeout(() => {
      isRestoring = false;
    }, 600);

    console.log(`[ShieldIt] Lockdown ended. Preserved and restored ${restoredCount} extensions.`);
    return { success: true, restoredCount };
  } catch (err) {
    isRestoring = false;
    console.error("[ShieldIt] Error restoring extensions:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Notify the exam tab about a violation
 */
function sendViolationToExamTab(violation) {
  if (!state.isLockdownActive) return;

  const payload = {
    source: "SHIELDIT_EXTENSION",
    type: "VIOLATION",
    violation: {
      ...violation,
      timestamp: Date.now(),
      examId: state.activeExamId
    }
  };

  console.warn("[ShieldIt VIOLATION]", violation);

  // Send to the tracked exam tab if known
  if (state.examTabId) {
    chrome.tabs.sendMessage(state.examTabId, payload).catch(() => {});
  }

  // Also broadcast to active tab in case tab ID changed
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id && tabs[0].id !== state.examTabId) {
      chrome.tabs.sendMessage(tabs[0].id, payload).catch(() => {});
    }
  });
}

// ----------------------------------------------------------------------
// EVENT LISTENERS & GUARDS
// ----------------------------------------------------------------------

/**
 * 1. Anti-Tampering: Detect if user attempts to re-enable an extension (e.g. Monica)
 */
chrome.management.onEnabled.addListener((info) => {
  if (!state.isLockdownActive || isRestoring) return;
  if (info.id === chrome.runtime.id) return;

  console.warn(`[ShieldIt Anti-Tamper] Forbidden extension enabled: ${info.name}`);

  // Immediately re-disable
  chrome.management.setEnabled(info.id, false).catch(() => {});

  sendViolationToExamTab({
    type: "UNAUTHORIZED_EXTENSION_ENABLED",
    name: info.name,
    extensionId: info.id,
    severity: "HIGH",
    message: `Attempted to activate blocked extension: ${info.name}`
  });
});

/**
 * 2. Tab Switch Guard: Detect when the user switches tabs
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!state.isLockdownActive) return;

  if (state.examTabId && activeInfo.tabId !== state.examTabId) {
    sendViolationToExamTab({
      type: "TAB_SWITCH",
      severity: "MEDIUM",
      fromTabId: state.examTabId,
      toTabId: activeInfo.tabId,
      message: "Switched away from the exam tab"
    });
  }
});

/**
 * 3. Window Blur / Focus Guard: Detect when window loses focus
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (!state.isLockdownActive) return;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    sendViolationToExamTab({
      type: "WINDOW_BLUR",
      severity: "MEDIUM",
      message: "Browser window lost focus (minimized or clicked outside)"
    });
  }
});

/**
 * 4. Display Guard: Detect display connection changes
 */
if (chrome.system && chrome.system.display) {
  chrome.system.display.onDisplayChanged.addListener(async () => {
    if (!state.isLockdownActive) return;

    const displays = await getConnectedDisplays();
    if (displays.length > 1) {
      sendViolationToExamTab({
        type: "DISPLAY_ADDED",
        severity: "CRITICAL",
        displayCount: displays.length,
        message: `External display connected (${displays.length} displays active)`
      });
    }
  });
}

/**
 * 5. Auto-cleanup: If exam tab is closed, restore extensions
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.isLockdownActive && state.examTabId === tabId) {
    console.log("[ShieldIt] Exam tab closed. Auto-restoring extensions...");
    stopLockdown(false, state.sessionSecret);
  }
});

/**
 * 6. Navigation Auto-Restore: If the exam tab navigates to results, auto-restore extensions
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (state.isLockdownActive && state.examTabId === tabId && tab.url) {
    // STRICT: Only auto-restore when the user has explicitly reached the exam results screen!
    if (tab.url.includes("/results")) {
      console.log("[ShieldIt] Exam results page reached. Auto-restoring extensions...");
      await stopLockdown(false, state.sessionSecret);
    }
  }
});

// ----------------------------------------------------------------------
// MESSAGE DISPATCHER (Web App & Internal Popup/Content)
// ----------------------------------------------------------------------

async function handleIncomingMessage(message, sender) {
  if (initPromise) {
    await initPromise;
  }
  const { action, payload } = message || {};
  console.log(`[ShieldIt Message Received] action: ${action}`, payload, sender);

  switch (action) {
    case "PING":
    case "HANDSHAKE": {
      const displays = await getConnectedDisplays();
      return {
        success: true,
        name: "ShieldIt",
        version: "1.0.1",
        buildTime: "13:40:00",
        isLockdownActive: state.isLockdownActive,
        activeExamId: state.activeExamId,
        displayCount: displays.length
      };
    }

    case "START_LOCKDOWN": {
      const tabId = sender.tab?.id || payload?.tabId;
      const secret = payload?.sessionSecret || payload?.options?.sessionSecret;
      return await startLockdown(payload?.examId || "unknown", tabId, payload?.options, secret);
    }

    case "STOP_LOCKDOWN": {
      const senderUrl = sender.tab?.url || sender.url || "";
      const isAuthorizedOrigin =
        senderUrl.includes("localhost") ||
        senderUrl.includes("127.0.0.1") ||
        senderUrl.includes("build-it") ||
        senderUrl.includes("buildit");
      const isResultsPage = senderUrl.includes("/results") || senderUrl.includes("/dashboard");
      // Allow valid secret, or authorized origin at completion/results
      const secret = payload?.sessionSecret || ((isResultsPage || isAuthorizedOrigin) ? state.sessionSecret : null);
      return await stopLockdown(payload?.forceAll || false, secret);
    }

    case "GET_STATUS": {
      const displays = await getConnectedDisplays();
      if (sender.tab?.id && state.isLockdownActive) {
        state.examTabId = sender.tab.id;
      }
      return {
        success: true,
        isLockdownActive: state.isLockdownActive,
        activeExamId: state.activeExamId,
        examTabId: state.examTabId,
        disabledCount: state.disabledExtensions.length,
        displays
      };
    }

    case "RESTORE_EXTENSIONS_EMERGENCY": {
      let examTabStillOnExam = false;
      if (state.examTabId) {
        try {
          const examTab = await chrome.tabs.get(state.examTabId);
          if (
            examTab &&
            examTab.url &&
            (examTab.url.includes("/session") || examTab.url.includes("test_sandbox"))
          ) {
            examTabStillOnExam = true;
          }
        } catch {
          examTabStillOnExam = false;
        }
      }

      if (state.isLockdownActive && examTabStillOnExam) {
        return {
          success: false,
          error: "EXAM_IN_PROGRESS",
          message: "Cannot restore extensions while an examination is actively in progress. Please submit or finish the exam first."
        };
      }
      return await stopLockdown(true);
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

// Listen for internal messages (from content.js or popup.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleIncomingMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

// Listen for external messages (from BuildIt web application)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleIncomingMessage(message, sender).then(sendResponse);
  return true;
});
