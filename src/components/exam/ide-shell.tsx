"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
  testCases: TestCase[];
}

interface IDEShellProps {
  questions: Question[];
  user: {
    name: string;
    image?: string;
  };
  endTime?: Date;
  examTitle: string;
}

export function IDEShell({
  questions,
  user,
  endTime,
  examTitle,
}: IDEShellProps) {
  const [activeQuestionId, setActiveQuestionId] = useQueryState("q", {
    defaultValue: questions[0]?.id || "",
  });

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

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
      />
      <SidebarInset>
        <ExamHeader user={user} endTime={endTime} examTitle={examTitle} />
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={40} minSize={30}>
              <ProblemViewer question={activeQuestion} />
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={60} minSize={30}>
              <CodePlayground question={activeQuestion} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
