"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { recordMalpractice } from "@/lib/actions/malpractice-actions";

interface AntiCheatGuardProps {
  assignmentId: string;
}

export function AntiCheatGuard({ assignmentId }: AntiCheatGuardProps) {
  const router = useRouter();
  const lastCopiedText = useRef<string>("");

  useEffect(() => {
    const handleViolation = async (type: string, details?: string) => {
      const result = await recordMalpractice(assignmentId, type, details);

      if (result.terminated && result.redirectPath) {
        toast.error("MALPRACTICE LIMIT EXCEEDED", {
          description: "Your exam has been terminated. Score set to 0.",
          duration: 10000,
        });
        router.push(result.redirectPath);
      } else if (result.success) {
        toast.warning("Warning: Malpractice Detected", {
          description: `${result.warningsLeft} warnings remaining before termination.`,
        });
      }
    };

    // 1. Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Copy/Cut
    const handleCopyCut = () => {
      const selection = window.getSelection();
      if (selection) {
        lastCopiedText.current = selection.toString();
      }
    };

    // 3. Paste
    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text") || "";
      if (pastedText && pastedText.trim() !== lastCopiedText.current.trim()) {
        e.preventDefault();
        toast.warning("External pasting is disabled.");
        handleViolation(
          "external_paste",
          "Attempted to paste external content",
        );
      }
    };

    // 4. Tab Switching
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation("tab_switch", "User switched tabs or minimized window");
      }
    };

    // 5. Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("fullscreen_exit", "Exited fullscreen mode");
      }
    };

    // Attach Listeners
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("copy", handleCopyCut, true);
    document.addEventListener("cut", handleCopyCut, true);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("fullscreenchange", handleFullscreenChange, true);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("copy", handleCopyCut, true);
      document.removeEventListener("cut", handleCopyCut, true);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
        true,
      );
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
        true,
      );
    };
  }, [assignmentId, router]);

  return null;
}
