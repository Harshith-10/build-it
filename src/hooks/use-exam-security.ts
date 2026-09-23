import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { recordMalpractice } from "@/actions/student/exams/malpractice-actions";

// Define strict types for the kinds of violations we detect
export type ViolationType =
  | "attempted_copy_paste"
  | "external_paste"
  | "tab_switch"
  | "window_blur"
  | "exited_fullscreen"
  | "right_click";

export interface ViolationEvent {
  type: ViolationType;
  isSevere: boolean;
  details?: string;
}

interface UseExamSecurityProps {
  assignmentId: string;
}

interface UseExamSecurityReturn {
  warnings: number;
  violationState: "idle" | "warning" | "severe_blocking";
  violationType: ViolationType | null;
  requestFullscreen: () => Promise<void>;
  resetViolationState: () => void;
}

const DEBOUNCE_MS = 2500;

function isLinuxClient() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform =
    navigator.platform ??
    navigator.userAgent;

  return /linux/i.test(platform);
}

export const useExamSecurity = ({
  assignmentId,
}: UseExamSecurityProps): UseExamSecurityReturn => {
  const router = useRouter();
  const [warnings, setWarnings] = useState<number>(0);
  const [violationState, setViolationState] = useState<
    "idle" | "warning" | "severe_blocking"
  >("idle");

  // Track internal clipboard content for "smart paste"
  const internalClipboard = useRef<string>("");

  // Track whether the first external paste warning has already been shown
  const externalPasteWarned = useRef<boolean>(false);

  // Debounce refs and startup grace period
  const lastViolationTime = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());
  const STARTUP_GRACE_PERIOD_MS = 4000;

  // State to track if we expect the user to be in fullscreen
  // We assume yes initially if they are in the exam session
  const [expectFullscreen, _setExpectFullscreen] = useState(true);
  const [violationType, setViolationType] = useState<ViolationType | null>(
    null,
  );

  const reportViolation = useCallback(
    async (type: ViolationType, isSevere: boolean, details?: string) => {
      if (isLinuxClient()) {
        return;
      }

      const now = Date.now();
      if (now - lastViolationTime.current < DEBOUNCE_MS) {
        return;
      }

      // Suppress transient blur/fullscreen violations during initial page mount & hydration
      if (
        (type === "window_blur" || type === "tab_switch" || type === "exited_fullscreen") &&
        Date.now() - mountTime.current < STARTUP_GRACE_PERIOD_MS
      ) {
        console.log(`[ExamSecurity] Startup grace period active; ignored violation: ${type}`);
        return;
      }

      lastViolationTime.current = now;

      console.log(`[ExamSecurity] Violation: ${type} (Severe: ${isSevere})`);

      // Update Local State
      if (isSevere) {
        setWarnings((prev) => prev + 1);
        setViolationState("severe_blocking");
        setViolationType(type);
      } else {
        setViolationState("warning");
      }

      // Show immediate feedback for non-blocking issues
      if (!isSevere) {
        if (type === "external_paste") {
          toast.error("External Paste Detected!", {
            description:
              "You're not allowed to paste content from outside the exam environment. This has been recorded.",
          });
        } else if (type === "right_click") {
          toast.warning("Right Click Disabled", {
            description: "Context menus are disabled.",
          });
        }
      }

      // Server Action
      try {
        const result = await recordMalpractice(
          assignmentId,
          type,
          details,
          isSevere,
        );

        if (result.terminated && result.redirectPath) {
          toast.error("MALPRACTICE LIMIT EXCEEDED", {
            description: "Exam terminated. Score set to 0.",
            duration: 10000,
          });
          router.push(result.redirectPath);
          return;
        }

        if (isSevere && result.success) {
          toast.error("Malpractice Recorded", {
            description: `${result.warningsLeft} warnings remaining before termination.`,
          });
        }
      } catch (error) {
        console.error("Failed to record malpractice:", error);
      }
    },
    [assignmentId, router],
  );

  useEffect(() => {
    if (isLinuxClient()) {
      return;
    }

    // 1. Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation("right_click", false, "Right click attempted");
    };

    // 2. Smart Copy/Paste/Cut
    const handleCopy = () => {
      const selection = window.getSelection();
      if (selection) {
        internalClipboard.current = selection.toString();
      }
    };

    const handleCut = () => {
      const selection = window.getSelection();
      if (selection) {
        internalClipboard.current = selection.toString();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text") || "";
      // Smart Check: Allow if matches internal clipboard
      // We trim to avoid minor whitespace issues
      if (
        pastedText &&
        pastedText.trim() !== internalClipboard.current.trim()
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const isSevere = externalPasteWarned.current;
        reportViolation(
          "external_paste",
          isSevere,
          `Attempted paste length: ${pastedText.length}`,
        );

        if (!externalPasteWarned.current) {
          externalPasteWarned.current = true;
        }
      }
      // If internal matches, allow it implicitly
    };

    // 3. Detect Tab Switching
    const handleVisibilityChange = () => {
      if (Date.now() - mountTime.current < STARTUP_GRACE_PERIOD_MS) {
        return;
      }
      if (document.hidden) {
        reportViolation("tab_switch", true, "Tab switch or window minimized");
      }
    };

    // 4. Detect Window Blur (Alt+Tab, clicking outside, switching to another app/window)
    const handleWindowBlur = (e: Event) => {
      // Ignore if focus is merely shifting between internal child DOM elements
      if (e.target && e.target !== window && e.target !== document) {
        return;
      }

      if (Date.now() - mountTime.current < STARTUP_GRACE_PERIOD_MS) {
        return;
      }

      // Small delay to verify if document really lost focus (vs intra-window focus change)
      setTimeout(() => {
        if (!document.hasFocus()) {
          reportViolation("window_blur", true, "Exam window lost focus (Alt+Tab or clicked outside)");
        }
      }, 200);
    };

    // 5. Fullscreen Check
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (Date.now() - mountTime.current < STARTUP_GRACE_PERIOD_MS) {
          return;
        }
        // If we expect fullscreen and lost it -> Violation
        if (expectFullscreen) {
          reportViolation("exited_fullscreen", true, "Exited fullscreen mode");
        }
      }
    };

    // 6. Shortcut Guard: Catch Alt+Tab and Meta/Windows key immediately at root capture phase
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && (e.key === "Tab" || e.code === "Tab")) ||
        (e.ctrlKey && (e.key === "Tab" || e.code === "Tab")) ||
        e.key === "Meta" ||
        e.key === "OS"
      ) {
        reportViolation("window_blur", true, "Application switch shortcut detected (Alt+Tab / Meta)");
      }
    };

    // 7. ShieldIt Extension Violation Listener (CustomEvent)
    const handleShieldItViolation = (
      e: CustomEvent<{ type?: string; message?: string }>,
    ) => {
      const vType = e.detail?.type;
      if (
        vType === "TAB_SWITCH" ||
        vType === "WINDOW_BLUR" ||
        vType === "BLOCKED_KEY_PRESS" ||
        vType === "UNAUTHORIZED_EXTENSION_ENABLED"
      ) {
        reportViolation(
          vType === "WINDOW_BLUR" ? "window_blur" : "tab_switch",
          true,
          e.detail?.message || "Focus lost or navigation away detected by ShieldIt",
        );
      }
    };

    // 8. ShieldIt Window Message Listener (postMessage bridge)
    const handleShieldItMessage = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.target === "SHIELDIT_WEB_APP" &&
        event.data.type === "SHIELDIT_VIOLATION"
      ) {
        const v = event.data.violation;
        const vType = v?.type;
        if (
          vType === "TAB_SWITCH" ||
          vType === "WINDOW_BLUR" ||
          vType === "BLOCKED_KEY_PRESS" ||
          vType === "UNAUTHORIZED_EXTENSION_ENABLED"
        ) {
          reportViolation(
            vType === "WINDOW_BLUR" ? "window_blur" : "tab_switch",
            true,
            v?.message || "Focus lost or navigation away detected by ShieldIt",
          );
        }
      }
    };

    // Attach Event Listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("message", handleShieldItMessage);
    window.addEventListener(
      "shieldit:violation" as unknown as keyof WindowEventMap,
      handleShieldItViolation as EventListener,
    );

    // Initial Fullscreen enforcement check
    if (!document.fullscreenElement && expectFullscreen) {
      // Don't auto-violation on mount, just set state to blocking so UI shows "Enter Fullscreen"
      setViolationState("severe_blocking");
    }

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("message", handleShieldItMessage);
      window.removeEventListener(
        "shieldit:violation" as unknown as keyof WindowEventMap,
        handleShieldItViolation as EventListener,
      );
    };
  }, [reportViolation, expectFullscreen]);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setViolationState("idle");
      setViolationType(null);
    } catch (err) {
      console.error("Fullscreen Request Failed", err);
      toast.error("Could not enter fullscreen. Please try again.");
    }
  };

  const resetViolationState = () => {
    setViolationState("idle");
    setViolationType(null);
  };

  return {
    warnings,
    violationState,
    violationType,
    requestFullscreen,
    resetViolationState,
  };
};
