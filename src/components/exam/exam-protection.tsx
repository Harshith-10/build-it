"use client";

import { AlertTriangle, Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useExamSecurity } from "@/hooks/use-exam-security";

interface ExamProtectionProps {
  assignmentId: string;
}

export function ExamProtection({ assignmentId }: ExamProtectionProps) {
  const { violationState, violationType, requestFullscreen } = useExamSecurity({
    assignmentId,
  });

  const isBlocking = violationState === "severe_blocking";
  const violationMessage =
    violationType === "external_paste"
      ? "An external paste was detected. Your exam session has recorded a malpractice incident."
      : "You must remain in fullscreen mode and keep the exam window focused at all times.";

  return (
    <AlertDialog open={isBlocking}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <AlertDialogTitle>Action Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div className="font-semibold text-foreground">
              Security Violation Detected
            </div>
            <div>{violationMessage}</div>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md border">
              <Lock className="h-3 w-3 inline mr-1 mb-0.5" />
              This incident has been recorded. Repeated violations may lead to
              automatic termination of your exam session.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={requestFullscreen} className="w-full">
            Return to Exam
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
