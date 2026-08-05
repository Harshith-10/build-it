"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, ClipboardList, Download, Loader2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadAttendanceExcel } from "@/lib/download-submissions-excel";
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
import { saveAttendance, postAttendance } from "../../labs";

interface Student {
  id: string;
  name: string;
  email: string;
  username: string | null;
  present: boolean;
}

interface AttendancePanelProps {
  exerciseId: string;
  exerciseNo?: number;
  exerciseTitle?: string;
  initialStudents: Student[];
  initialPosted: boolean;
  groupId?: string;
}

export function AttendancePanel({
  exerciseId,
  exerciseNo = 1,
  exerciseTitle = "Exercise",
  initialStudents,
  initialPosted,
  groupId,
}: AttendancePanelProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [posted, setPosted] = useState(initialPosted);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isPosting, startPosting] = useTransition();

  // Sync state when section / initialStudents changes
  useEffect(() => {
    setStudents(initialStudents);
    setPosted(initialPosted);
  }, [initialStudents, initialPosted]);

  const handleDownloadExcel = () => {
    downloadAttendanceExcel({
      exerciseNo,
      exerciseTitle,
      students,
    });
  };

  const presentIds = students.filter((s) => s.present).map((s) => s.id);
  const presentCount = presentIds.length;
  const totalCount = students.length;

  function toggleStudent(id: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, present: !s.present } : s))
    );
  }

  function selectAll() {
    setStudents((prev) => prev.map((s) => ({ ...s, present: true })));
  }

  function deselectAll() {
    setStudents((prev) => prev.map((s) => ({ ...s, present: false })));
  }

  function handleSaveOrPost() {
    if (!posted) {
      setShowPostDialog(true);
      return;
    }
    startPosting(async () => {
      const res = await saveAttendance({
        exerciseId,
        presentStudentIds: presentIds,
        filterGroupId: groupId,
      });
      if (res.success) {
        toast.success("Attendance updated successfully.");
      } else {
        toast.error(res.error ?? "Failed to update attendance");
      }
    });
  }

  function handleConfirmPost() {
    startPosting(async () => {
      const saveRes = await saveAttendance({
        exerciseId,
        presentStudentIds: presentIds,
        filterGroupId: groupId,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error ?? "Failed to save attendance");
        return;
      }
      const postRes = await postAttendance(exerciseId);
      if (postRes.success) {
        setPosted(true);
        toast.success(
          "Attendance posted! Absent students are now locked out.",
        );
      } else {
        toast.error(postRes.error ?? "Failed to post attendance");
      }
    });
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No Students Found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          No students are assigned to a group for this exercise. Assign groups first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground">{presentCount}</span> / {totalCount} present
            </span>
          </div>
          {posted ? (
            <Badge className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Attendance Posted
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Circle className="h-3 w-3" />
              Not Posted
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
            Deselect All
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="gap-1.5 text-xs h-7">
            <Download className="h-3.5 w-3.5" />
            Download Excel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveOrPost}
            disabled={isSaving || isPosting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {(isSaving || isPosting) && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {posted ? "Save Attendance" : "Post Attendance"}
          </Button>
        </div>
      </div>

      {posted && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <strong>Attendance is live.</strong> Absent students are locked out. You can still update attendance — changes take effect immediately.
        </div>
      )}

      {/* Student list */}
      <div className="border rounded-lg divide-y overflow-hidden">
        {students.map((student) => (
          <button
            key={student.id}
            type="button"
            onClick={() => toggleStudent(student.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${student.present ? "bg-green-50/60 dark:bg-green-950/10" : ""
              }`}
          >
            {student.present ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold font-mono tracking-wider truncate">
                {student.username ? student.username.toUpperCase() : student.name}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                student.present
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 text-xs"
                  : "text-muted-foreground text-xs"
              }
            >
              {student.present ? "Present" : "Absent"}
            </Badge>
          </button>
        ))}
      </div>

      {/* Post confirmation dialog */}
      <AlertDialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              {posted
                ? `This will update the attendance. Currently ${presentCount} of ${totalCount} students are marked present. Absent students will immediately lose access.`
                : `This will lock out ${totalCount - presentCount} absent student${totalCount - presentCount !== 1 ? "s" : ""
                } from this exercise. ${presentCount} student${presentCount !== 1 ? "s" : ""
                } will retain access. This action activates immediately — you can still edit attendance after posting.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setShowPostDialog(false);
                handleConfirmPost();
              }}
            >
              Post Attendance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
