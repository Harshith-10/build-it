"use client";

import {
  AlertTriangle,
  BookOpen,
  Clock,
  KeyRound,
  Monitor,
  Shield,
} from "lucide-react";
import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useExamOnboarding } from "@/hooks/use-exam-onboarding";

interface OnboardingClientProps {
  exam: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    questionCount: number;
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

  const [showInstructionsDialog, setShowInstructionsDialog] = useState(true);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [instructionsAcknowledged, setInstructionsAcknowledged] =
    useState(false);

  const questionCountLabel =
    exam.questionCount === 1 ? "1 Question" : `${exam.questionCount} Questions`;
  const questionCountText =
    exam.questionCount === 1 ? "1 question" : `${exam.questionCount} questions`;

  const handleInstructionsAcknowledged = () => {
    setInstructionsAcknowledged(true);
    setShowInstructionsDialog(false);
  };

  const handleButtonClick = () => {
    if (!instructionsAcknowledged) {
      return;
    }

    if (exam.requiresPin) {
      setPin("");
      setPinDialogOpen(true);
      return;
    }

    handleStartExam();
  };

  const handlePinConfirm = () => {
    setPinDialogOpen(false);
    handleStartExam();
  };

  return (
    <>
      <Dialog
        open={showInstructionsDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowInstructionsDialog(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-2xl">Mandatory Exam Rules</DialogTitle>
            <DialogDescription>
              Read these rules carefully. You must acknowledge them before the
              start option becomes available.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-semibold">Exam Overview</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {exam.durationMinutes} minutes · {questionCountLabel}
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Do</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  Disable notifications on your device before starting the exam.
                </li>
                <li>
                  Keep a stable internet connection throughout the entire exam.
                </li>
                <li>
                  Stay focused on the exam window and remain in fullscreen mode
                  for the duration of the test.
                </li>
                <li>
                  Click the Submit button when you are finished. The exam will
                  not be evaluated unless it is submitted.
                </li>
              </ul>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Don't</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  Do not switch tabs or windows, minimize the browser, or leave
                  fullscreen.
                </li>
                <li>
                  Do not use external copy and paste. Internal copy and paste
                  inside the exam is allowed, but anything from outside the exam
                  is blocked.
                </li>
                <li>
                  Do not spam the Run or Submit buttons. Use them only when you
                  intentionally want to execute or finalize your answer.
                </li>
                <li>
                  Do not rely on the browser back button or refresh to manage
                  your attempt.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={handleInstructionsAcknowledged}>
              I Have Read and Understand the Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-4xl shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{exam.title}</CardTitle>
            <CardDescription className="text-lg">
              This exam contains {questionCountText} and lasts{" "}
              {exam.durationMinutes} minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{exam.durationMinutes} Minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>{questionCountLabel}</span>
              </div>
              {exam.requiresPin && (
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                  <KeyRound className="h-4 w-4" />
                  <span>PIN Required</span>
                </div>
              )}
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Strict Environment Enforced</AlertTitle>
              <AlertDescription>
                This exam is monitored. Switching tabs, minimizing the window,
                or exiting fullscreen will be recorded as malpractice incidents.
              </AlertDescription>
            </Alert>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <Monitor className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h4 className="font-semibold">Fullscreen Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      The exam must be taken in fullscreen mode using a modern
                      desktop browser.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <Shield className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h4 className="font-semibold">No Distractions</h4>
                    <p className="text-sm text-muted-foreground">
                      Clipboard access is restricted. Background activity is
                      monitored.
                    </p>
                  </div>
                </div>
              </div>

              {exam.description ? (
                <div className="h-full rounded-lg bg-muted p-4">
                  <h4 className="mb-2 font-semibold">Exam Instructions</h4>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {exam.description}
                  </p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-4">
                  <p className="text-center text-sm text-muted-foreground">
                    No additional exam description provided.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-8">
            <Button
              size="lg"
              onClick={handleButtonClick}
              disabled={isLoading || !instructionsAcknowledged}
              className="w-full max-w-sm text-lg"
            >
              {isLoading
                ? "Initializing..."
                : exam.requiresPin
                  ? "Continue to PIN"
                  : "Start Exam"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <KeyRound className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">Enter Exam PIN</DialogTitle>
            <DialogDescription>
              This exam requires a PIN provided by your proctor. Enter it below
              to proceed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP
              id="exam-pin-dialog"
              maxLength={6}
              value={pin}
              onChange={(value) => setPin(value)}
              autoFocus
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
            <p className="text-xs text-muted-foreground">
              Contact your proctor if you haven&apos;t received the PIN.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={handlePinConfirm}
              disabled={pin.length !== 6 || isLoading}
            >
              {isLoading ? "Initializing..." : "Confirm & Start Exam"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setPinDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
