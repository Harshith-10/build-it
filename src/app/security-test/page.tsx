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
import {
  useExamSecurity,
  type ViolationEvent,
  type ViolationType,
} from "@/hooks/use-exam-security";

export default function ExamPage() {
  const [isBlocked, setIsBlocked] = useState(true);
  const [lastViolation, setLastViolation] = useState<ViolationType | null>(
    null,
  );

  const handleViolation = (event: ViolationEvent) => {
    const { type, isSevere } = event;
    console.warn(`User violation detected: ${type} (Severe: ${isSevere})`);
    setLastViolation(type);

    // Example: Block the screen immediately on tab switch
    if (
      type === "tab_switch" ||
      type === "window_blur" ||
      type === "exited_fullscreen"
    ) {
      setIsBlocked(true);
    }

    // TODO: Send this event to your backend logs
  };

  const { warnings } = useExamSecurity(handleViolation);

  return (
    <div className="min-h-screen">
      <div className="h-screen w-full p-8">
        <h1>Exam in Progress</h1>
        <p>Warnings: {warnings}</p>
        <p>Violation: {lastViolation}</p>
        {/* Exam content goes here */}
      </div>
      {isBlocked && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <Card className="min-w-sm">
            <CardHeader>
              <CardTitle className="text-3xl">Exam Paused</CardTitle>
              <CardDescription className="text-base">
                Your exam has paused for security reasons. Please return to
                fullscreen to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant={"destructive"}
                size={"lg"}
                onClick={() => {
                  setIsBlocked(false);
                  document.documentElement.requestFullscreen();
                }}
              >
                Resume Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
