"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { markProgramSolved } from "@/actions/student/labs/submissions";
import { useQueryState } from "nuqs";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { LabSidebar } from "./lab-sidebar";
import { LabHeader } from "./lab-header";
import { LabProblemViewer } from "./lab-problem-viewer";
import { LabCodePlayground } from "./lab-code-playground";

export interface LabProgram {
  id: string;
  programNo: number;
  title: string;
  description?: string | null;
  testCases: Array<{ id: string; input: string; expectedOutput: string }>;
}

export interface LabExercise {
  id: string;
  exerciseNo: number;
  title: string;
}

interface LabIDEShellProps {
  programs: LabProgram[];
  exercise: LabExercise;
  labId: string;
  solvedIds: string[];
  user: {
    name: string;
    image?: string;
  };
}

export function LabIDEShell({
  programs,
  exercise,
  labId,
  solvedIds,
  user,
}: LabIDEShellProps) {
  const [activeProgramId, setActiveProgramId] = useQueryState("p", {
    defaultValue: programs[0]?.id || "",
  });

  const [solvedSet, setSolvedSet] = useState(new Set(solvedIds));
  const [isMarking, setIsMarking] = useState(false);
  const [canMarkSolved, setCanMarkSolved] = useState(false);
  const [_mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Reset canMarkSolved whenever the active program changes
  useEffect(() => { setCanMarkSolved(false); }, [activeProgramId]);

  const activeProgram =
    programs.find((p) => p.id === activeProgramId) || programs[0];

  if (!activeProgram) {
    return (
      <div className="flex h-screen items-center justify-center">
        No programs available.
      </div>
    );
  }

  const handleSolved = (programId: string) => {
    setSolvedSet((prev) => new Set([...prev, programId]));
  };

  const handleMarkSolved = async () => {
    if (!canMarkSolved) {
      toast.error("Run your code and pass all test cases first");
      return;
    }
    setIsMarking(true);
    try {
      const res = await markProgramSolved({
        programId: activeProgram.id,
        exerciseId: exercise.id,
      });
      if (res.success) {
        handleSolved(activeProgram.id);
        toast.success("Program marked as solved!");
      } else {
        toast.error(res.error ?? "Failed to mark as solved");
      }
    } finally {
      setIsMarking(false);
    }
  };

  return (
    // ✅ fixed inset-0 z-50 overlays the entire student layout
    <div className="fixed inset-0 z-50">
      <SidebarProvider>
        <LabSidebar
          exerciseTitle={exercise.title}
          exerciseNo={exercise.exerciseNo}
          programs={programs}
          activeId={activeProgramId || activeProgram.id}
          onSelect={setActiveProgramId}
          solvedIds={[...solvedSet]}
        />
        <SidebarInset className="h-screen overflow-hidden flex flex-col">
          <LabHeader
            user={user}
            exerciseTitle={exercise.title}
            labId={labId}
            exerciseId={exercise.id}
            isSolved={solvedSet.has(activeProgram.id)}
            isMarking={isMarking}
            canMarkSolved={canMarkSolved}
            onMarkSolved={handleMarkSolved}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ResizablePanelGroup orientation="horizontal" className="h-full">
              <ResizablePanel defaultSize={40} minSize={30}>
                <LabProblemViewer
                  program={activeProgram}
                  exercise={exercise}
                  isSolved={solvedSet.has(activeProgram.id)}
                />
              </ResizablePanel>
              <ResizableHandle withHandle handleOrientation="vertical" />
              <ResizablePanel defaultSize={60} minSize={30}>
                <LabCodePlayground
                  key={activeProgram.id}
                  program={activeProgram}
                  exercise={exercise}
                  labId={labId}
                  isSolved={solvedSet.has(activeProgram.id)}
                  onSolved={() => handleSolved(activeProgram.id)}
                  onCanMarkSolvedChange={setCanMarkSolved}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}