import { useEffect, useRef, useState } from "react";

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

interface UseExamSecurityReturn {
  warnings: number;
  isFullscreen: boolean;
}

const DEBOUNCE_MS = 1000;

export const useExamSecurity = (
  onViolation: (event: ViolationEvent) => void,
): UseExamSecurityReturn => {
  const [warnings, setWarnings] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track internal clipboard content for "smart paste"
  const internalClipboard = useRef<string>("");

  // Debounce refs
  const lastViolationTime = useRef<number>(0);

  useEffect(() => {
    const reportViolation = (
      type: ViolationType,
      isSevere: boolean,
      details?: string,
    ) => {
      const now = Date.now();
      if (now - lastViolationTime.current < DEBOUNCE_MS) {
        return;
      }
      lastViolationTime.current = now;

      if (isSevere) {
        setWarnings((prev) => prev + 1);
      }
      onViolation({ type, isSevere, details });
    };

    // 1. Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Right click is NOT severe
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
      // Check if pasted text matches internal clipboard
      // We trim to avoid minor whitespace issues, but exact match is best for security.
      // If internal clipboard is empty or mismatch, it's external.
      if (pastedText && pastedText !== internalClipboard.current) {
        e.preventDefault();
        // External paste is NOT severe (log only)
        reportViolation(
          "external_paste",
          false,
          `Attempted paste: "${pastedText.slice(0, 50)}..."`,
        );
      }
      // If internal matches, allow it.
    };

    // 3. Detect Tab Switching
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switch IS severe
        reportViolation("tab_switch", true, "Tab switch or window minimized");
      }
    };

    // 4. Detect Window Blur (clicking outside browser/iframe)
    const handleWindowBlur = () => {
      // Blur IS severe
      reportViolation("window_blur", true, "Window lost focus");
    };

    // 5. Fullscreen Check
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        // Exit fullscreen IS severe
        reportViolation("exited_fullscreen", true, "Exited fullscreen mode");
      } else {
        setIsFullscreen(true);
      }
    };

    // Attach Event Listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy); // Track copy
    document.addEventListener("cut", handleCut); // Track cut
    document.addEventListener("paste", handlePaste);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleWindowBlur);

    // Initial check
    if (document.fullscreenElement) {
      setIsFullscreen(true);
    }

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [onViolation]);

  return { warnings, isFullscreen };
};
