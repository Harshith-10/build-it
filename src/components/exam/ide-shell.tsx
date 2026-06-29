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
import type { ExamTimingSnapshot } from "@/lib/exam";
import { useExamStore } from "@/stores/exam-store";

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

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    initForExam(assignmentId);
  }, [assignmentId, initForExam]);

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
              />
            </ResizablePanel>

            <ResizableHandle withHandle handleOrientation="vertical" />

            <ResizablePanel defaultSize={60} minSize={30}>
              <CodePlayground
                question={activeQuestion}
                assignmentId={assignmentId}
                isCodingLocked={hardDeadlineReached}
                latestSubmissions={latestSubmissions}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
