"use client";

import { AlertTriangle, BookOpen, Clock, Monitor, Shield } from "lucide-react";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useExamOnboarding } from "@/hooks/use-exam-onboarding";

interface OnboardingClientProps {
  exam: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    startTime: Date;
    endTime: Date;
    requiresPin: boolean;
  };
}

export default function OnboardingClient({ exam }: OnboardingClientProps) {
  const { isLoading, pin, setPin, handleStartExam } = useExamOnboarding({
    examId: exam.id,
    requiresPin: exam.requiresPin,
  });

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

          {exam.requiresPin && (
            <div className="mx-auto flex flex-col items-center justify-center space-y-4">
              <div className="text-center">
                <Label htmlFor="exam-pin" className="text-base font-semibold">
                  Exam PIN Required
                </Label>
              </div>
              <InputOTP
                id="exam-pin"
                maxLength={6}
                value={pin}
                onChange={(value) => setPin(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pb-8">
          <Button
            size="lg"
            onClick={handleStartExam}
            disabled={isLoading || (exam.requiresPin && pin.length !== 6)}
            className="w-full max-w-sm text-lg"
          >
            {isLoading ? "Initializing..." : "I Understand, Start Exam"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
