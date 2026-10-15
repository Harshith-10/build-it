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

    if (data.isLockdownActive) {
      // 1. Exam is actively running
      badge.textContent = "Protected";
      badge.className = "badge badge-active";
      dot.className = "dot dot-active";
      title.textContent = "Exam In Progress";
      desc.textContent = "All unauthorized extensions and shortcuts are locked by BuildIt for academic integrity.";

      detailsCard.style.display = "flex";
      examIdEl.textContent = data.activeExamId || "In Session";
      pausedCountEl.textContent = `${data.disabledCount || 0} extensions paused`;
      monitorCountEl.textContent = `${data.displays?.length || 1} display(s)`;

      // Anti-tamper: Students CANNOT restore extensions mid-exam
      btnRestore.disabled = true;
      btnRestore.textContent = "🔒 Restoring Disabled During Exam";
      btnRestore.title = "You cannot restore extensions while an examination is actively open.";
    } else if (data.disabledCount > 0) {
      // 2. Exam concluded - extensions waiting to be restored
      badge.textContent = "Exam Concluded";
      badge.className = "badge badge-idle";
      dot.className = "dot dot-idle";
      title.textContent = "Exam Completed";
      desc.textContent = "Your exam has concluded. You can restore your personal extensions now.";

      detailsCard.style.display = "flex";
      examIdEl.textContent = data.activeExamId || "Completed";
      pausedCountEl.textContent = `${data.disabledCount} extensions ready to restore`;
      monitorCountEl.textContent = `${data.displays?.length || 1} display(s)`;

      btnRestore.disabled = false;
      btnRestore.textContent = "Restore All My Extensions";
      btnRestore.title = "Restore your previous extensions";
    } else {
      // 3. Normal idle standby
      badge.textContent = "Idle";
      badge.className = "badge badge-idle";
      dot.className = "dot dot-idle";
      title.textContent = "No Active Exam";
      desc.textContent = "ShieldIt is standing by. When you begin an exam on BuildIt, this shield will automatically secure your environment.";

      detailsCard.style.display = "none";
      btnRestore.disabled = false;
      btnRestore.textContent = "Restore / Re-enable Extensions";
      btnRestore.title = "Click to re-enable your personal browser extensions.";
    }
  }

  // Fetch status directly from background service worker
  chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      desc.textContent = "Could not communicate with ShieldIt proctor.";
      return;
    }
    renderStatus(response);
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
