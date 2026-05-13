"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { markProgramSolved } from "@/actions/student/labs/submissions";
import { Button } from "@/components/ui/button";

interface ProgramCardProps {
  program: {
    id: string;
    programNo: number;
    title: string;
    description: string | null;
  };
  exerciseId: string;
  isSolved: boolean;
}

export function ProgramCard({
  program,
  exerciseId,
  isSolved: initialSolved,
}: ProgramCardProps) {
  const [isSolved, setIsSolved] = useState(initialSolved);
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkSolved = async () => {
    if (isSolved) return;
    setIsLoading(true);
    try {
      const res = await markProgramSolved({
        programId: program.id,
        exerciseId,
      });
      if (res.success) {
        setIsSolved(true);
        toast.success("Marked as solved!");
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 flex items-center gap-4 transition-colors ${
        isSolved
          ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
          : ""
      }`}
    >
      <div className="shrink-0">
        {isSolved ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {program.programNo}. {program.title}
        </p>
        {program.description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {program.description}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {isSolved ? (
          <span className="text-xs text-green-600 font-medium">Solved</span>
        ) : (
          <Button size="sm" onClick={handleMarkSolved} disabled={isLoading}>
            {isLoading && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Mark Solved
          </Button>
        )}
      </div>
    </div>
  );
}
