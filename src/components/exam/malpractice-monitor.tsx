"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function MalpracticeMonitor({
  children,
}: {
  children: React.ReactNode;
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [violationType, setViolationType] = useState("");

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setViolationType("You exited fullscreen mode.");
        setWarningOpen(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationType("You switched tabs/windows.");
        setWarningOpen(true);
      }
    };

    const handleBlur = () => {
      // Blur can be triggered by interacting with browser chrome, etc.
      // Often redundant with visibilityChange but catches window focus loss specifically.
      setViolationType("You lost focus on the exam window.");
      setWarningOpen(true);
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
