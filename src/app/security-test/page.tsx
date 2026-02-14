"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExamSecurity } from "@/hooks/use-exam-security";

export default function ExamPage() {
  const [isBlocked, setIsBlocked] = useState(false);

  // Use dummy ID for testing. Server actions will likely fail but tracking works.
  const { warnings, violationState, requestFullscreen, resetViolationState } =
    useExamSecurity({
      assignmentId: "test-assignment-id",
    });

  // Sync blocking state with hook or local override
  const effectiveBlocked = isBlocked || violationState === "severe_blocking";

  return (
    <div className="min-h-screen">
      <div className="h-screen w-full p-8">
        <h1>Exam in Progress (Security Test)</h1>
        <p>Warnings: {warnings}</p>
        <p>Violation State: {violationState}</p>
        <p className="text-sm text-muted-foreground my-2">
          Try switching tabs, minimizing window, or right clicking.
        </p>
        <Button onClick={() => setIsBlocked(true)} variant="outline">
          Simulate Manual Block
        </Button>
      </div>
      {effectiveBlocked && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <Card className="min-w-sm">
            <CardHeader>
              <CardTitle className="text-3xl">Exam Paused</CardTitle>
              <CardDescription className="text-base">
                Your exam has paused for security reasons. Please return to
                fullscreen to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant={"destructive"}
                size={"lg"}
                className="w-full"
                onClick={() => {
                  setIsBlocked(false);
                  resetViolationState(); // Reset hook state if needed
                  requestFullscreen();
                }}
              >
                Resume Exam (Enter Fullscreen)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
