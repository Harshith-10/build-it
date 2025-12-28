"use client";

import { AlertTriangle, BookOpen, Clock, Monitor, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initializeExamSession } from "@/lib/actions/exam-actions";

interface OnboardingClientProps {
  exam: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    startTime: Date;
    endTime: Date;
  };
}

export default function OnboardingClient({ exam }: OnboardingClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartExam = async () => {
    try {
      // 1. Request Fullscreen
      await document.documentElement.requestFullscreen();
    } catch (error) {
      toast.error(
        "Fullscreen is required to take this exam. Please grant permission.",
      );
      return;
    }

    setIsLoading(true);

    try {
      // 2. Initialize Session
      const result = await initializeExamSession(exam.id);

      if (result.success) {
        toast.success("Exam started successfully.");
        router.push(`/exams/${exam.id}/session`);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{exam.title}</CardTitle>
          <CardDescription className="text-lg">
            Please read the rules carefully before starting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{exam.durationMinutes} Minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>3 Questions</span>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Strict Environment Enforced</AlertTitle>
            <AlertDescription>
              This exam is monitored. Switching tabs, minimizing the window, or
              exiting fullscreen will be recorded as malpractice incidents.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Monitor className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold">Fullscreen Mode</h4>
                <p className="text-sm text-muted-foreground">
                  The exam must be taken in fullscreen mode using a modern
                  desktop browser.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Shield className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold">No Distractions</h4>
                <p className="text-sm text-muted-foreground">
                  Clipboard access is restricted. Background activity is
                  monitored.
                </p>
              </div>
            </div>
          </div>

          {exam.description && (
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-semibold">Instructions</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {exam.description}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pb-8">
          <Button
            size="lg"
            onClick={handleStartExam}
            disabled={isLoading}
            className="w-full max-w-sm text-lg"
          >
            {isLoading ? "Initializing..." : "I Understand, Start Exam"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
