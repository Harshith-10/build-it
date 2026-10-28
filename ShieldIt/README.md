# 🛡️ ShieldIt - Exam & Laboratory Lockdown Extension

> Official proctoring and secure testing environment companion for **BuildIt**.

---

## 📖 Overview

**ShieldIt** is a lightweight, high-security browser extension designed to protect the integrity of online exams and coding laboratory assessments. It acts as an active shield against unauthorized assistance, browser tampering, and cheating extensions.

### Core Capabilities

* 🔒 **AI Extension Lockdown:** Automatically disables active third-party extensions (including AI tools like **Monica**, Harpa, Sider, ChatGPT helpers, solvers, and translation plugins) before the exam starts.
* 🔄 **Safe Restoration Guarantee:** Memorizes the student's active extension configuration and restores every single extension back to its original state as soon as the exam ends or is submitted.
* 🚨 **Anti-Tampering:** Listens for `chrome.management.onEnabled`. If a student attempts to re-enable a forbidden tool mid-exam, ShieldIt immediately re-disables it and logs a severe violation.
* 🖥️ **Display Guard:** Detects connected monitors using `chrome.system.display`. Flags or restricts the session if secondary monitors or screen-mirroring devices are detected.
* 👁️ **Tab & Window Focus Monitor:** Hooks into `chrome.tabs.onActivated` and `chrome.windows.onFocusChanged` at the browser engine level, preventing spoofing by Tampermonkey or page-level userscripts.
* ⌨️ **Input & Shortcut Blocker:** Blocks DevTools (`F12`, `Ctrl+Shift+I/J/C`), View Source (`Ctrl+U`), Print (`Ctrl+P`), and common AI hotkeys (`Alt+M`, `Alt+A`), as well as copy/cut within the exam container.
* 🛟 **Emergency Fallback:** Includes a "Restore All My Extensions" button in the popup in case of an unexpected crash or network interruption.

---

## 🚀 How to Install (For Students & Developers)

Since ShieldIt is built on **Manifest V3**, it works seamlessly on **Google Chrome, Microsoft Edge, Brave, and Opera**.

### Step 1: Open Extensions Page
* In Google Chrome, navigate to: `chrome://extensions/`
* In Microsoft Edge, navigate to: `edge://extensions/`
* In Brave, navigate to: `brave://extensions/`

### Step 2: Enable Developer Mode
* In the top-right corner of the extensions page, toggle **"Developer mode"** to **ON**.

### Step 3: Load the Extension
1. Click the **"Load unpacked"** button in the top-left corner.
2. Select the `ShieldIt` folder (located at `d:\Projects\build-it\ShieldIt`).
3. **ShieldIt** will immediately appear in your browser toolbar with the shield logo!

---

## 💻 Web Application Integration

Your BuildIt web application communicates with ShieldIt using either `window.postMessage` or `chrome.runtime.sendMessage`.

### 1. Check if ShieldIt is Active (Handshake)

```javascript
window.postMessage({
  target: "SHIELDIT_EXTENSION",
  action: "PING"
}, "*");

window.addEventListener("message", (event) => {
  if (event.data?.target === "SHIELDIT_WEB_APP") {
    console.log("ShieldIt is installed:", event.data);
  }
});
```

### 2. Start Exam Lockdown

```javascript
window.postMessage({
  target: "SHIELDIT_EXTENSION",
  action: "START_LOCKDOWN",
  payload: {
    examId: "exam_uuid_123",
    options: {
      allowMultipleDisplays: false
    }
  }
}, "*");
```

### 3. Listen for Violations

```javascript
window.addEventListener("shieldit:violation", (e) => {
  const violation = e.detail;
  console.warn("Exam violation recorded:", violation);
  // Example violation types:
  // - TAB_SWITCH
  // - WINDOW_BLUR
  // - DISPLAY_ADDED
  // - UNAUTHORIZED_EXTENSION_ENABLED
  // - BLOCKED_KEY_PRESS
});
```

### 4. Stop Lockdown (Restore Extensions)

```javascript
window.postMessage({
  target: "SHIELDIT_EXTENSION",
  action: "STOP_LOCKDOWN"
}, "*");
```

---

## 📁 Project Structure

```
ShieldIt/
├── manifest.json       # Manifest V3 configuration & permission grants
├── background.js       # Background service worker (lockdown engine & guards)
├── content.js          # In-page script (shortcuts, devtools & bridge)
├── content.css         # Visual security badge and text-selection controls
├── popup/
│   ├── popup.html      # Status viewer & emergency restore interface
│   ├── popup.css       # Dark-mode styling matching BuildIt
│   └── popup.js        # Dynamic monitor counter & restore handler
├── icons/              # 16px, 48px, 128px high-resolution shield icons
├── generate_icons.js   # Zero-dependency PNG generator script
└── README.md           # Documentation
```
