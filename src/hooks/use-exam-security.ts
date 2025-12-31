import { useEffect, useState } from "react";

// Define strict types for the kinds of violations we detect
export type ViolationType =
  | "attempted_copy_paste"
  | "tab_switch"
  | "window_blur"
  | "exited_fullscreen"
  | "right_click";

interface UseExamSecurityReturn {
  warnings: number;
}

export const useExamSecurity = (
  onViolation: (type: ViolationType) => void,
): UseExamSecurityReturn => {
  const [warnings, setWarnings] = useState<number>(0);

  useEffect(() => {
    // 1. Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onViolation("right_click");
    };

    // 2. Prevent Copy/Paste/Cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      onViolation("attempted_copy_paste");
    };

    // 3. Detect Tab Switching
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarnings((prev) => prev + 1);
        onViolation("tab_switch");
      }
    };

    // 4. Detect Window Blur (clicking outside browser/iframe)
    const handleWindowBlur = () => {
      setWarnings((prev) => prev + 1);
      onViolation("window_blur");
    };

    // 5. Force Fullscreen Check
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setWarnings((prev) => prev + 1);
        onViolation("exited_fullscreen");
      }
    };

    // Attach Event Listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleWindowBlur);

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [onViolation]);

  return { warnings };
};
