"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { getExamTimingSnapshot } from "@/actions/student/exams/exam-lifecycle";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toast } from "sonner";
import type { ExamTimingSnapshot } from "@/lib/exam";
import { AlertTriangle, Check, Copy, RotateCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExamStore } from "@/stores/exam-store";
import { useShieldIt } from "@/lib/shieldit/shieldit-client";

import { CodePlayground } from "./code-playground";
import { ExamHeader } from "./exam-header";
import { ExamSidebar } from "./exam-sidebar";
import { ProblemViewer } from "./problem-viewer";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface Question {
  id: string;
  title: string;
  problemStatement: string;
  difficulty: "easy" | "medium" | "hard";
  driverCode: Record<string, string> | null;
  testCases: TestCase[];
}

interface IDEShellProps {
  questions: Question[];
  user: {
    id: string;
    name: string;
    image?: string;
  };
  timingSnapshot: ExamTimingSnapshot;
  examTitle: string;
  assignmentId: string;
  completedQuestionIds: string[];
  latestSubmissions?: Record<string, Record<string, string>>;
}

function formatCountdown(ms: number): string {
  const safeMs = Math.max(0, ms);
  const hours = Math.floor(safeMs / (1000 * 60 * 60));
  const minutes = Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((safeMs % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function IDEShell({
  questions,
  user,
  timingSnapshot,
  examTitle,
  assignmentId,
  completedQuestionIds,
  latestSubmissions,
}: IDEShellProps) {
  const [activeQuestionId, setActiveQuestionId] = useQueryState("q", {
    defaultValue: questions[0]?.id || "",
  });

  const [_isMounted, setIsMounted] = useState(false);
  const [timing, setTiming] = useState(timingSnapshot);
  const [serverOffsetMs, setServerOffsetMs] = useState(
    timingSnapshot.serverNowMs - Date.now(),
  );
  const [syncedNowMs, setSyncedNowMs] = useState(
    Date.now() + (timingSnapshot.serverNowMs - Date.now()),
  );

  const initForExam = useExamStore((s) => s.initForExam);
  const { violations, isInstalled, isLockdownActive, startLockdown, checkStatus } =
    useShieldIt(assignmentId);

  const [isCheckingExtension, setIsCheckingExtension] = useState(false);
  const [copiedExtensionsUrl, setCopiedExtensionsUrl] = useState(false);

  const handleManualRecheck = async () => {
    setIsCheckingExtension(true);
    try {
      const status = await checkStatus();
      if (status.installed) {
        toast.success("ShieldIt detected! Resuming examination...");
      } else {
        toast.error("ShieldIt is still not detected", {
          description:
            "Please ensure the toggle is ON in chrome://extensions and try again.",
        });
      }
    } catch {
      toast.error("Extension check timed out. Please verify ShieldIt is turned ON.");
    } finally {
      setIsCheckingExtension(false);
    }
  };

  const handleCopyExtensionsUrl = async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      setCopiedExtensionsUrl(true);
      toast.success("Copied 'chrome://extensions' to clipboard!", {
        description:
          "Open a new tab (Ctrl+T / Cmd+T), paste into address bar, and toggle ShieldIt ON.",
      });
      setTimeout(() => setCopiedExtensionsUrl(false), 3000);
    } catch {
      toast.info("Please open chrome://extensions in a new tab to manage extensions.");
    }
  };

  // Reinforce lockdown if in active exam session
  useEffect(() => {
    if (isInstalled && !isLockdownActive) {
      startLockdown(assignmentId, true).catch(() => {});
    }
  }, [isInstalled, isLockdownActive, assignmentId, startLockdown]);

  useEffect(() => {
    if (violations.length > 0) {
      const latest = violations[violations.length - 1];
      toast.warning(`Security Notice: ${latest.message || latest.type}`);
    }
  }, [violations]);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    initForExam(user.id, assignmentId);
  }, [user.id, assignmentId, initForExam]);

  useEffect(() => {
    setTiming(timingSnapshot);
    setServerOffsetMs(timingSnapshot.serverNowMs - Date.now());
  }, [timingSnapshot]);

  useEffect(() => {
    setSyncedNowMs(Date.now() + serverOffsetMs);

    const interval = setInterval(() => {
      setSyncedNowMs(Date.now() + serverOffsetMs);
    }, 1000);

    return () => clearInterval(interval);
  }, [serverOffsetMs]);

  useEffect(() => {
    let disposed = false;

    const syncTiming = async () => {
      const result = await getExamTimingSnapshot(assignmentId);

      if (!disposed && result.success && result.timing) {
        setTiming(result.timing.timing);
        setServerOffsetMs(result.timing.timing.serverNowMs - Date.now());
      }
    };

    syncTiming();
    const interval = setInterval(syncTiming, 60000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [assignmentId]);

  const hardDeadlineReached = syncedNowMs >= timing.deadlineMs;
  const graceExpired = syncedNowMs > timing.graceDeadlineMs;
  const timeLeft = formatCountdown(timing.deadlineMs - syncedNowMs);

  const activeQuestion =
    questions.find((q) => q.id === activeQuestionId) || questions[0];

  if (!activeQuestion)
    return (
      <div className="flex h-screen items-center justify-center">
        No questions available.
      </div>
    );

  return (
    <SidebarProvider>
      <ExamSidebar
        examTitle={examTitle}
        questions={questions}
        activeId={activeQuestionId || activeQuestion.id}
        onSelect={setActiveQuestionId}
        completedQuestionIds={completedQuestionIds}
      />
      <SidebarInset className="h-screen overflow-hidden flex flex-col">
        <ExamHeader
          user={user}
          timeLeft={timeLeft}
          hardDeadlineReached={hardDeadlineReached}
          graceExpired={graceExpired}
          examTitle={examTitle}
          assignmentId={assignmentId}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={30}>
              <ProblemViewer
                question={activeQuestion}
                assignmentId={assignmentId}
                userId={user.id}
              />
            </ResizablePanel>

            <ResizableHandle withHandle handleOrientation="vertical" />

            <ResizablePanel defaultSize={60} minSize={30}>
              <CodePlayground
                question={activeQuestion}
                assignmentId={assignmentId}
                userId={user.id}
                isCodingLocked={hardDeadlineReached || isInstalled === false}
                latestSubmissions={latestSubmissions}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Anti-Malpractice Lockout: Freezes exam immediately if ShieldIt is turned off */}
        {isInstalled === false && (
          <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6 ring-8 ring-destructive/20 animate-pulse">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-destructive">
              Security Violation: ShieldIt Proctor Disabled
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              The <strong>ShieldIt</strong> proctoring extension was turned off, disabled, or removed from your browser during an active examination.
            </p>
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 max-w-lg text-left text-xs space-y-2">
              <p className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Academic Integrity Notice
              </p>
              <p className="text-muted-foreground">
                Turning off proctoring extensions mid-exam is recorded as an academic integrity violation. The examination environment has been frozen until ShieldIt is re-enabled.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="default"
                disabled={isCheckingExtension}
                className="bg-destructive hover:bg-destructive/90 text-white gap-2 shadow-sm font-medium"
                onClick={handleManualRecheck}
              >
                <RotateCw className={`h-4 w-4 ${isCheckingExtension ? "animate-spin" : ""}`} />
                {isCheckingExtension ? "Checking Status..." : "Re-check Extension Status"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/30 hover:bg-destructive/10 text-foreground font-medium"
                onClick={handleCopyExtensionsUrl}
              >
                {copiedExtensionsUrl ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
                {copiedExtensionsUrl ? "Copied chrome://extensions" : "Copy chrome://extensions"}
              </Button>
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <p>
                Open a new tab to <code className="bg-muted px-1.5 py-0.5 rounded font-mono select-all">chrome://extensions</code> and toggle <strong>ShieldIt</strong> back ON.
              </p>
              <p className="text-emerald-500 font-medium">
                ⚡ Auto-resumes immediately once ShieldIt is enabled — no page reload required.
              </p>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
