"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  getShieldItExamChallenge,
  initializeExamSession,
} from "@/actions/student/exams/exam-actions";
import { useSession } from "@/lib/auth-client";
import { useExamStore } from "@/stores/exam-store";

import {
  startShieldItLockdown,
  stopShieldItLockdown,
  requestShieldItSignature,
} from "@/lib/shieldit/shieldit-client";

interface UseExamOnboardingProps {
  examId: string;
  requiresPin: boolean;
}

export function useExamOnboarding({
  examId,
  requiresPin,
}: UseExamOnboardingProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [pin, setPin] = useState("");
  const initForExam = useExamStore((s) => s.initForExam);

  const handleStartExam = async () => {
    if (requiresPin && !pin) {
      toast.error("Please enter the exam PIN.");
      return;
    }

    try {
      // 1. Request Fullscreen
      await document.documentElement.requestFullscreen();
    } catch (_error) {
      toast.error(
        "Fullscreen is required to take this exam. Please grant permission.",
      );
      return;
    }

    setIsLoading(true);

    try {
      // 2. Activate ShieldIt extension lockdown (pauses Monica, AI copilots, etc.)
      const lockResult = await startShieldItLockdown(examId, {
        allowMultipleDisplays: false,
      });

      if (!lockResult.success) {
        toast.error(
          lockResult.message || "ShieldIt lockdown failed. Please close other windows.",
        );
        await document.exitFullscreen().catch(() => {});
        setIsLoading(false);
        return;
      }

      // 3. Optional Cryptographic Handshake Signature
      let shielditPayload = null;
      try {
        const challengeRes = await getShieldItExamChallenge();
        if (challengeRes.success && challengeRes.userId && challengeRes.nonce) {
          const sigRes = await requestShieldItSignature(challengeRes.userId, examId, {
            nonce: challengeRes.nonce,
            timestamp: challengeRes.timestamp,
          });
          if (sigRes.success && sigRes.nonce && sigRes.timestamp && sigRes.extensionId) {
            shielditPayload = {
              extensionId: sigRes.extensionId,
              version: sigRes.version || "1.0.1",
              nonce: sigRes.nonce,
              timestamp: sigRes.timestamp,
            };
          }
        }
      } catch (handshakeErr) {
        console.warn("ShieldIt cryptographic handshake skipped/deferred:", handshakeErr);
      }

      // 4. Initialize Session on server
      const result = await initializeExamSession(examId, pin, shielditPayload);

      if (result.success && result.assignmentId) {
        initForExam(session?.user?.id || "", result.assignmentId);
        toast.success("Exam started successfully.");
        router.push(`/exams/${examId}/session`);
      } else if (result.success) {
        await stopShieldItLockdown(examId).catch(() => {});
        await document.exitFullscreen().catch(() => {});
        toast.error("Failed to start exam: missing assignment id.");
      } else {
        await stopShieldItLockdown(examId).catch(() => {});
        await document.exitFullscreen().catch(() => {});
        toast.error(result.error || "Failed to start exam.");
      }
    } catch (error) {
      console.error(error);
      await stopShieldItLockdown(examId).catch(() => {});
      await document.exitFullscreen().catch(() => {});
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    pin,
    setPin,
    handleStartExam,
  };
}
