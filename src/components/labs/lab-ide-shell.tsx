"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { markProgramSolved, submitExercise } from "@/actions/student/labs/submissions";
import { checkAttendanceStatus } from "@/actions/student/labs/attendance";
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
import { LabProtection } from "./lab-protection";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface LabProgram {
  id: string;
  programNo: number;
  title: string;
  description?: string | null;
  testCases: Array<{ id: string; input: string; expectedOutput: string; isHidden: boolean }>;
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
  const router = useRouter();
  const [activeProgramId, setActiveProgramId] = useQueryState("p", {
    defaultValue: programs[0]?.id || "",
  });

  const [solvedSet, setSolvedSet] = useState(new Set(solvedIds));
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [_mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => setMounted(true), []);

  // Poll every 30s to detect if attendance has been posted and student is absent
  useEffect(() => {
    const check = async () => {
      const result = await checkAttendanceStatus(exercise.id);
      if (result.locked) {
        setLocked(true);
      }
    };
    // Initial check after 15s (gives time for page to load)
    const initial = setTimeout(check, 15000);
    // Then every 30s
    const interval = setInterval(check, 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [exercise.id]);

  const activeProgram =
    programs.find((p) => p.id === activeProgramId) || programs[0];

  if (!activeProgram) {
    return (
      <div className="flex h-screen items-center justify-center">
        No programs available.
      </div>
    );
  }

  // ─── Attendance lockout overlay ───────────────────────────────────────────
  if (locked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Access Removed</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              You were not marked as present for this exercise. Your progress has been removed by the faculty.
            </p>
          </div>
          <Button asChild>
            <Link
              href={`/labs/${labId}`}
              onClick={async () => {
                if (typeof document !== "undefined" && document.fullscreenElement) {
                  await document.exitFullscreen().catch(() => {});
                }
              }}
            >
              Back to Labs
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleSolved = (programId: string) => {
    setSolvedSet((prev) => new Set([...prev, programId]));
  };

  const handleSubmitExercise = () => {
    setShowSubmitDialog(true);
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
            onSubmit={handleSubmitExercise}
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
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <LabProtection />

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent className="md:ml-32">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exercise?</AlertDialogTitle>
            <AlertDialogDescription>
              {solvedSet.size === programs.length
                ? "Are you sure you want to submit this exercise and view your marks?"
                : `You have only solved ${solvedSet.size} out of ${programs.length} programs. Are you sure you want to submit this exercise and view your marks?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={async () => {
                if (typeof document !== "undefined" && document.fullscreenElement) {
                  await document.exitFullscreen().catch(() => {});
                }
                const res = await submitExercise(exercise.id);
                if (res.success) {
                  router.push(`/labs/${labId}/${exercise.id}/results`);
                } else {
                  toast.error(res.error ?? "Failed to submit exercise");
                }
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}