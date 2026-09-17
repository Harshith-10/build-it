/**
 * ShieldIt - Popup Controller
 * Displays student exam lockdown status in read-only mode during exams.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const badge = document.getElementById("status-badge");
  const dot = document.getElementById("status-dot");
  const title = document.getElementById("status-title");
  const desc = document.getElementById("status-desc");
  const detailsCard = document.getElementById("lockdown-details");
  const examIdEl = document.getElementById("exam-id");
  const pausedCountEl = document.getElementById("paused-count");
  const monitorCountEl = document.getElementById("monitor-count");
  const btnRestore = document.getElementById("btn-emergency-restore");
  const msgEl = document.getElementById("restore-message");

  function renderStatus(data) {
    if (!data) return;

    if (data.isLockdownActive && data.isOnExamSession) {
      badge.textContent = "Protected";
      badge.className = "badge badge-active";
      dot.className = "dot dot-active";
      title.textContent = "Exam In Progress";
      desc.textContent = "All unauthorized extensions and shortcuts are locked by BuildIt for academic integrity.";

      detailsCard.style.display = "flex";
      examIdEl.textContent = data.activeExamId || "In Session";
      pausedCountEl.textContent = `${data.disabledCount || 0} extensions paused`;
      monitorCountEl.textContent = `${data.displays?.length || 1} display(s)`;

      // Anti-tamper: Students CANNOT restore extensions mid-exam while session is open
      btnRestore.disabled = true;
      btnRestore.textContent = "🔒 Restoring Disabled During Exam";
      btnRestore.title = "You cannot restore extensions while an examination is actively open.";
    } else {
      badge.textContent = data.isLockdownActive ? "Exam Ended" : "Idle";
      badge.className = "badge badge-idle";
      dot.className = "dot dot-idle";
      title.textContent = data.isLockdownActive ? "Exam Completed" : "No Active Exam";
      desc.textContent = data.isLockdownActive
        ? "Your exam has concluded. You can restore your personal extensions now."
        : "ShieldIt is standing by. When you begin an exam on BuildIt, this shield will automatically secure your environment.";

      detailsCard.style.display = data.isLockdownActive ? "flex" : "none";
      if (data.isLockdownActive) {
        examIdEl.textContent = data.activeExamId || "Submitted";
        pausedCountEl.textContent = `${data.disabledCount || 0} extensions ready to restore`;
      }
      btnRestore.disabled = false;
      btnRestore.textContent = "Restore All My Extensions";
      btnRestore.title = "Restore your previous extensions";
    }
  }

  // Fetch status and check current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const isOnExamSession =
      !!(currentTab?.url &&
      (currentTab.url.includes("/session") || currentTab.url.includes("test_sandbox")));

    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        desc.textContent = "Could not communicate with ShieldIt proctor.";
        return;
      }
      renderStatus({ ...response, isOnExamSession });
    });
  });

  // Emergency restore button (only works when NO exam is active)
  btnRestore.addEventListener("click", () => {
    msgEl.className = "restore-message";
    msgEl.textContent = "Restoring extensions...";

    chrome.runtime.sendMessage({ action: "RESTORE_EXTENSIONS_EMERGENCY" }, (response) => {
      if (response && response.success) {
        msgEl.className = "restore-message msg-success";
        msgEl.textContent = `Restored ${response.restoredCount || 0} extensions.`;
        setTimeout(() => {
          window.close();
        }, 1200);
      } else {
        msgEl.className = "restore-message msg-error";
        msgEl.textContent = response?.message || "Restoration denied.";
      }
    });
  });
});
