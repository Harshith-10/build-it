"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEBOUNCE_MS = 300;

export function MalpracticeMonitor({
  children,
}: {
  children: React.ReactNode;
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [violationType, setViolationType] = useState("");
  const lastAlertTime = useRef<number>(0);

  useEffect(() => {
    const showWarning = (message: string) => {
      // Debounce: skip if an alert was shown within the last DEBOUNCE_MS
      const now = Date.now();
      if (now - lastAlertTime.current < DEBOUNCE_MS) {
        return;
      }
      lastAlertTime.current = now;
      setViolationType(message);
      setWarningOpen(true);
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        showWarning("You exited fullscreen mode.");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        showWarning("You switched tabs/windows.");
      }
    };

    const handleBlur = () => {
      // Blur can be triggered by interacting with browser chrome, etc.
      // Often redundant with visibilityChange but catches window focus loss specifically.
      showWarning("You lost focus on the exam window.");
    };

    // Fullscreen enforcement
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // Tab switching detection
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Window focus detection
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleAcknowledge = () => {
    setWarningOpen(false);
    // Attempt to restore fullscreen
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Could not restore fullscreen:", err);
      });
    }
  };

  return (
    <>
      {children}
      <AlertDialog open={warningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Malpractice Alert
            </AlertDialogTitle>
            <AlertDialogDescription>
              {violationType} This action has been recorded by the system.
              <br />
              Please remain in fullscreen and do not switch tabs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleAcknowledge}>
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
