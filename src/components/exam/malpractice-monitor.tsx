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
import { useExamSecurity, ViolationType } from "@/hooks/use-exam-security";

// This component now primarily handles the visual Blocking/Warning interface
// and ensures Fullscreen is active.
export function MalpracticeMonitor({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // We actually don't need to listen to violations here unless we want to show
  // the "Malpractice Alert" dialog for things other than Fullscreen exit.
  // The AntiCheatGuard will handle the generic Toasts and recording.
  // But MalpracticeMonitor is the wrapper, so it's a good place to enforce visual blocking.

  const {} = useExamSecurity(() => {
    // We let AntiCheatGuard handle the side-effects (logging/toasts)
    // Here we just react to state changes if needed.
  });

  useEffect(() => {
    // Initial check and subsequent checks for fullscreen
    const checkFullscreen = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenPrompt(true);
      } else {
        setShowFullscreenPrompt(false);
      }
    };

    checkFullscreen();
    document.addEventListener("fullscreenchange", checkFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", checkFullscreen);
  }, []);

  const handleEnterFullscreen = () => {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error("Could not enter fullscreen:", err);
    });
  };

  return (
    <>
      <div
        className={
          showFullscreenPrompt ? "blur-sm pointer-events-none select-none" : ""
        }
      >
        {children}
      </div>

      <AlertDialog open={showFullscreenPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Fullscreen Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter fullscreen mode to continue your exam.
              <br />
              Exiting fullscreen mode during the exam is recorded as a
              violation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleEnterFullscreen}>
              Enter Fullscreen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
