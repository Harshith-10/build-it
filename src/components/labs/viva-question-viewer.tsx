"use client";

import { HelpCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AssignedVivaQuestion } from "@/actions/student/labs/viva";

interface VivaQuestionViewerProps {
  question: AssignedVivaQuestion;
  totalQuestions: number;
}

export function VivaQuestionViewer({
  question,
  totalQuestions,
}: VivaQuestionViewerProps) {
  return (
    <div className="flex h-full flex-col bg-background p-6 overflow-y-auto">
      {/* Header Badges */}
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 px-3 py-1 font-semibold text-xs">
            <HelpCircle className="h-3.5 w-3.5 mr-1 inline" />
            Viva Question {question.questionNo} of {totalQuestions}
          </Badge>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {question.maxMarks} Marks
        </Badge>
      </div>

      {/* Question Content */}
      <div className="space-y-4 flex-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Question Statement
        </h3>
        <div className="rounded-lg border bg-muted/20 p-5 text-base leading-relaxed font-medium text-foreground shadow-sm">
          {question.questionText}
        </div>
      </div>
    </div>
  );
}
