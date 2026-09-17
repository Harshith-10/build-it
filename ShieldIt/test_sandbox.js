/**
 * ShieldIt Test Sandbox Controller
 * Demonstrates handshake, lockdown, authorized unlock, and tamper protection.
 */

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("status-panel");
  const warningBox = document.getElementById("file-url-warning");
  const chkMultiDisplay = document.getElementById("chk-multidisplay");

  let currentSessionSecret = null;

  // Detect if running on file:// protocol
  if (window.location.protocol === "file:") {
    warningBox.style.display = "block";
  }

  function log(msg, type = "info") {
    const div = document.createElement("div");
    div.className = `log-item log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
  }

  // Direct chrome.runtime support if opened as an extension page
  const isExtensionPage = typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;

  let hasReceivedAnyResponse = false;

  function sendMessageToShieldIt(action, payload = {}) {
    const correlationId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (isExtensionPage) {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        handleShieldItResponse({ action, ...response });
      });
    } else {
      window.postMessage(
        {
          target: "SHIELDIT_EXTENSION",
          action,
          payload,
          correlationId
        },
        "*"
      );

      // Timeout notification if no response received
      if (action === "PING") {
        setTimeout(() => {
          if (!hasReceivedAnyResponse) {
            log("❌ No response from ShieldIt extension after 1.5s.", "warning");
            log("👉 If on file://, enable 'Allow access to file URLs' in chrome://extensions -> ShieldIt Details.", "warning");
            log("👉 Also ensure Developer Mode is ON and ShieldIt is loaded.", "warning");
          }
        }, 1500);
      }
    }
  }

  function handleShieldItResponse(data) {
    if (!data) return;
    hasReceivedAnyResponse = true;

    // Violations streamed from extension
    if (data.type === "SHIELDIT_VIOLATION") {
      log(`🚨 VIOLATION RECORDED: ${data.violation.type} - ${data.violation.message || ""}`, "violation");
      return;
    }

    // Ping / Handshake response
    if (data.name === "ShieldIt") {
      if (data.version !== "1.0.1") {
        log(`⚠️ CACHE WARNING: Chrome is still running older ShieldIt v${data.version || "1.0.0"}!`, "violation");
        log("👉 To force Chrome to load v1.0.1: Go to chrome://extensions, toggle the ShieldIt switch OFF, then ON.", "violation");
      } else {
        log(`✅ Connected to ShieldIt v1.0.1 (Lockdown active: ${data.isLockdownActive}, Displays: ${data.displayCount})`, "success");
      }
      return;
    }

    // Start lockdown response
    if (data.action === "START_LOCKDOWN" || (data.disabledCount !== undefined && data.success)) {
      if (data.success) {
        currentSessionSecret = data.sessionSecret || currentSessionSecret;
        log(`🔒 LOCKDOWN STARTED! Paused ${data.disabledCount} extensions.`, "success");
        log(`🔑 Session Security Token: ${currentSessionSecret}`, "info");
        if (data.disabledNames && data.disabledNames.length > 0) {
          log(`Paused tools: ${data.disabledNames.join(", ")}`, "info");
        }
      } else {
        log(`❌ Lockdown failed: ${data.error || data.message}`, "violation");
      }
      return;
    }

    // Stop lockdown response
    if (data.action === "STOP_LOCKDOWN" || data.error === "INVALID_SECRET" || data.error === "EXAM_IN_PROGRESS" || data.error === "NO_ACTIVE_LOCKDOWN") {
      log(`Response details: success=${data.success}, error=${data.error || "none"}`, data.success ? "success" : "violation");
      if (data.success) {
        log(`🔓 LOCKDOWN TERMINATED. Restored ${data.restoredCount || 0} extensions.`, "success");
        currentSessionSecret = null;
      } else {
        log(`⛔ UNLOCK REJECTED: ${data.error || data.message}`, "violation");
        log("🛡️ ShieldIt security guard blocked the unauthorized attempt. Lockdown remains active.", "warning");
      }
      return;
    }

    log(`Response: ${JSON.stringify(data)}`, "info");
  }

  // Listen for Web App message bridge
  window.addEventListener("message", (e) => {
    if (e.data?.target === "SHIELDIT_WEB_APP") {
      handleShieldItResponse(e.data);
    }
  });

  // Listen for CustomEvent violations
  window.addEventListener("shieldit:violation", (e) => {
    log(`🚨 IN-PAGE GUARD: ${e.detail.type} - ${e.detail.message}`, "violation");
  });

  // 1. Handshake
  document.getElementById("btn-ping").addEventListener("click", () => {
    log("Sending PING to ShieldIt extension...", "info");
    sendMessageToShieldIt("PING");
  });

  // 2. Start Lockdown (Issues session token)
  document.getElementById("btn-lock").addEventListener("click", () => {
    const generatedSecret = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    currentSessionSecret = generatedSecret;
    log("Starting lockdown with authorized session token...", "info");
    sendMessageToShieldIt("START_LOCKDOWN", {
      examId: "EXAM_DEMO_001",
      sessionSecret: generatedSecret,
      options: {
        allowMultipleDisplays: chkMultiDisplay.checked
      }
    });
  });

  // 3. Authorized Stop Lockdown (Passes the genuine session token)
  document.getElementById("btn-unlock").addEventListener("click", () => {
    log(`Sending authorized STOP_LOCKDOWN with token: ${currentSessionSecret || "none"}...`, "info");
    sendMessageToShieldIt("STOP_LOCKDOWN", {
      sessionSecret: currentSessionSecret
    });
  });

  // 4. Unauthorized Tamper Test (Simulates hacker or student trying fake token)
  document.getElementById("btn-tamper").addEventListener("click", () => {
    log("⚠️ Simulating unauthorized student unlock with fake token ('fake_stolen_token_123')...", "warning");
    sendMessageToShieldIt("STOP_LOCKDOWN", {
      sessionSecret: "fake_stolen_token_123"
    });
  });

  document.getElementById("btn-clear").addEventListener("click", () => {
    panel.innerHTML = "";
  });

  // Auto-handshake on load to verify connected version
  setTimeout(() => {
    log("Checking connection to ShieldIt extension...", "info");
    sendMessageToShieldIt("PING");
  }, 300);
});
