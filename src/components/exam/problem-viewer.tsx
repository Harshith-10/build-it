"use client";

import Markdown from "react-markdown";
import type { Question } from "./ide-shell";

interface ProblemViewerProps {
  question: Question;
}

export function ProblemViewer({ question }: ProblemViewerProps) {
  if (!question) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a question to view.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">{question.title}</h1>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <Markdown>{question.problemStatement}</Markdown>
      </div>
    </div>
  );
}
