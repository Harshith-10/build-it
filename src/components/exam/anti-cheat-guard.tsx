"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  useExamSecurity,
  type ViolationEvent,
} from "@/hooks/use-exam-security";
import { recordMalpractice } from "@/lib/actions/malpractice-actions";

interface AntiCheatGuardProps {
  assignmentId: string;
}

export function AntiCheatGuard({ assignmentId }: AntiCheatGuardProps) {
  const router = useRouter();

  const onViolation = useCallback(
    async (event: ViolationEvent) => {
      const { type, isSevere, details } = event;
      console.log(
        `[AntiCheat] Violation: ${type} (Severe: ${isSevere})`,
        details,
      );

      if (!isSevere) {
        // Warning only
        if (type === "external_paste") {
          toast.warning("Paste Blocked", {
            description: "External content cannot be pasted.",
          });
        } else if (type === "right_click") {
          toast.warning("Right Click Disabled", {
            description: "Context menus are disabled during the exam.",
          });
        }
      }

      // Record in DB
      const result = await recordMalpractice(
        assignmentId,
        type,
        details,
        isSevere,
      );

      if (isSevere) {
        if (result.terminated && result.redirectPath) {
          toast.error("MALPRACTICE LIMIT EXCEEDED", {
            description: "Your exam has been terminated. Score set to 0.",
            duration: 10000,
          });
          router.push(result.redirectPath);
        } else if (result.success) {
          toast.error("Malpractice Recorded", {
            description: `${result.warningsLeft} warnings remaining before termination.`,
          });
        }
      }
    },
    [assignmentId, router],
  );

  useExamSecurity(onViolation);

  return null;
}
