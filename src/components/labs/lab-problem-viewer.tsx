"use client";

import { CheckCircle2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LabProgram, LabExercise } from "./lab-ide-shell";

interface LabProblemViewerProps {
  program: LabProgram;
  exercise: LabExercise;
  isSolved: boolean;
}

export function LabProblemViewer({
  program,
  exercise,
  isSolved,
}: LabProblemViewerProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b px-4 shrink-0 flex items-center">
        <span className="h-10 flex items-center text-sm font-medium border-b-2 border-foreground pr-1">
          Description
        </span>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Exercise {exercise.exerciseNo} · {exercise.title}
            </p>
            <h2 className="text-2xl font-bold">
              {program.programNo}. {program.title}
            </h2>
            {isSolved && (
              <div className="flex items-center gap-1.5 mt-2 text-green-500 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Solved
              </div>
            )}
          </div>

          {program.description ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>
                {program.description}
              </Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No description provided.
            </p>
          )}

          {/* Inline examples from test cases */}
          {program.testCases.length > 0 && (
            <div className="space-y-3">
              {program.testCases.slice(0, 2).map((tc, idx) => (
                <div key={tc.id} className="space-y-1">
                  <p className="text-sm font-semibold">Example {idx + 1}</p>
                  <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Input: </span>
                      {tc.input}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Output: </span>
                      {tc.expectedOutput}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}