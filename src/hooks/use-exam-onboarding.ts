"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { initializeExamSession } from "@/actions/student/exams/exam-actions";
import { useExamStore } from "@/stores/exam-store";

interface UseExamOnboardingProps {
  examId: string;
  requiresPin: boolean;
}

export function useExamOnboarding({
  examId,
  requiresPin,
}: UseExamOnboardingProps) {
  const router = useRouter();
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
      // 2. Initialize Session
      const result = await initializeExamSession(examId, pin);

      if (result.success) {
        initForExam(result.assignmentId!);
        toast.success("Exam started successfully.");
        router.push(`/exams/${examId}/session`);
      } else {
        // If failed, exit fullscreen (optional, but good UX)
        await document.exitFullscreen().catch(() => {});
        toast.error(result.error || "Failed to start exam.");
      }
    } catch (error) {
      console.error(error);
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
