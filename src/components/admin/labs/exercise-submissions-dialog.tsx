"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Users } from "lucide-react";
import { getExerciseSubmissions } from "@/app/(faculty)/faculty/labs/labs";
import { downloadSubmissionsExcel } from "@/lib/download-submissions-excel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExerciseSubmissionsDialogProps {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseTitle: string;
  exerciseNo: number;
}

export function ExerciseSubmissionsDialog({
  open,
  onClose,
  exerciseId,
  exerciseTitle,
  exerciseNo,
}: ExerciseSubmissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    programs: { id: string; programNo: number; title: string }[];
    students: {
      id: string;
      name: string;
      email: string;
      solvedProgramIds: string[];
      marks: number | null;
    }[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getExerciseSubmissions(exerciseId)
      .then((res) => {
        if (res.success && res.data) {
          setData({
            programs: res.data.exercise.programs,
            students: res.data.students,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [open, exerciseId]);

  const handleDownload = () => {
    if (!data) return;
    downloadSubmissionsExcel({
      exerciseNo,
      exerciseTitle,
      programs: data.programs,
      students: data.students,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Exercise {exerciseNo} — {exerciseTitle}
              </DialogTitle>
              <DialogDescription>
                Student submissions for this exercise
              </DialogDescription>
            </div>
            {data && data.students.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 shrink-0"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <div className="bg-muted mb-4 rounded-full p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No Submissions Yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              No students have submitted programs for this exercise yet.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  {data.programs.map((p) => (
                    <TableHead
                      key={p.id}
                      className="text-center text-xs"
                      title={p.title}
                    >
                      P{p.programNo}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Solved</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.email}
                        </p>
                      </div>
                    </TableCell>
                    {data.programs.map((p) => {
                      const solved = student.solvedProgramIds.includes(p.id);
                      return (
                        <TableCell key={p.id} className="text-center">
                          {solved ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {student.solvedProgramIds.length}/{data.programs.length}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {student.marks !== null ? student.marks : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}