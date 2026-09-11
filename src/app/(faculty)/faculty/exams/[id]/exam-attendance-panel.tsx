"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Download,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  getAvailableExamSections,
  getExamAttendance,
  postExamAttendance,
  saveExamAttendance,
} from "@/actions/admin/exams";
import { downloadExamAttendanceExcel } from "@/lib/download-submissions-excel";

interface Student {
  id: string;
  name: string;
  email: string;
  username: string | null;
  present: boolean;
}

interface Section {
  id: string;
  name: string;
}

interface ExamAttendancePanelProps {
  examId: string;
  examTitle: string;
}

export function ExamAttendancePanel({
  examId,
  examTitle,
}: ExamAttendancePanelProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [posted, setPosted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isPosting, startPosting] = useTransition();

  // Load available sections on mount
  useEffect(() => {
    async function loadSections() {
      try {
        const available = await getAvailableExamSections(examId);
        setSections(available);
        if (available.length === 1) {
          setSelectedGroupId(available[0].id);
        }
      } catch (err) {
        console.error("Failed to load sections", err);
      }
    }
    loadSections();
  }, [examId]);

  // Load attendance data whenever section changes
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const filterGroup =
          selectedGroupId === "all" ? undefined : selectedGroupId;
        const res = await getExamAttendance(examId, filterGroup);
        if (res.success && res.data) {
          setStudents(res.data.students);
          setPosted(res.data.attendancePosted);
        } else {
          toast.error(res.error || "Failed to load attendance");
        }
      } catch (err) {
        console.error("Failed to fetch attendance", err);
        toast.error("Failed to load attendance");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [examId, selectedGroupId]);

  const selectedSection = sections.find((s) => s.id === selectedGroupId);
  const presentIds = students.filter((s) => s.present).map((s) => s.id);
  const presentCount = presentIds.length;
  const totalCount = students.length;

  const toggleStudent = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, present: !s.present } : s)),
    );
  };

  const selectAll = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, present: true })));
  };

  const deselectAll = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, present: false })));
  };

  const handleDownloadExcel = () => {
    downloadExamAttendanceExcel({
      examTitle,
      sectionName: selectedSection?.name,
      students,
    });
  };

  const handleSaveAttendance = () => {
    startSaving(async () => {
      const res = await saveExamAttendance({
        examId,
        presentStudentIds: presentIds,
        filterGroupId: selectedGroupId === "all" ? undefined : selectedGroupId,
      });
      if (res.success) {
        toast.success("Attendance saved successfully.");
      } else {
        toast.error(res.error || "Failed to save attendance");
      }
    });
  };

  const handleConfirmPost = () => {
    startPosting(async () => {
      // 1. Save current attendance marks
      const saveRes = await saveExamAttendance({
        examId,
        presentStudentIds: presentIds,
        filterGroupId: selectedGroupId === "all" ? undefined : selectedGroupId,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error || "Failed to save attendance before posting");
        return;
      }

      // 2. Post attendance to activate lockout
      const postRes = await postExamAttendance(examId);
      if (postRes.success) {
        setPosted(true);
        toast.success(
          "Attendance posted! Absent students are now locked out of the exam.",
        );
      } else {
        toast.error(postRes.error || "Failed to post attendance");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div className="flex items-center gap-3 flex-wrap">
          {sections.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Section:
              </span>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger className="w-48 h-9 bg-background">
                  <SelectValue placeholder="Select section..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assigned Sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background px-3 py-1.5 rounded-lg border">
            <ClipboardList className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground">
                {presentCount}
              </span>{" "}
              / {totalCount} present
            </span>
          </div>

          {posted ? (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800 gap-1.5 py-1 px-2.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Attendance Posted (Lockout Active)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground gap-1.5 py-1 px-2.5"
            >
              <Circle className="h-3 w-3" />
              Not Posted (No Lockout)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="text-xs h-8"
            disabled={isLoading || students.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deselectAll}
            className="text-xs h-8"
            disabled={isLoading || students.length === 0}
          >
            Deselect All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            className="gap-1.5 text-xs h-8"
            disabled={isLoading || students.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAttendance}
            disabled={isLoading || isSaving || isPosting || students.length === 0}
            className="text-xs h-8"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save Attendance
          </Button>
          {!posted ? (
            <Button
              size="sm"
              onClick={() => setShowPostDialog(true)}
              disabled={isLoading || isSaving || isPosting || students.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1.5"
            >
              {isPosting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <ShieldAlert className="h-3.5 w-3.5" />
              Post Attendance
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSaveAttendance}
              disabled={isLoading || isSaving || isPosting || students.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Update Live Attendance
            </Button>
          )}
        </div>
      </div>

      {posted && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-900 p-4 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Attendance is posted and live.</p>
            <p className="text-xs opacity-90 mt-0.5">
              Students marked absent are immediately locked out from starting or continuing the exam.
              You can toggle status and click &quot;Update Live Attendance&quot; to restore access or mark someone absent at any time.
            </p>
          </div>
        </div>
      )}

      {/* Student List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading student list...</span>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center bg-card">
          <div className="bg-muted mb-4 rounded-full p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Students Found</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            There are no students enrolled in the assigned group(s) for this exam.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl divide-y overflow-hidden bg-card shadow-sm">
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => toggleStudent(student.id)}
              className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/40 cursor-pointer ${
                student.present
                  ? "bg-green-50/40 dark:bg-green-950/15"
                  : "bg-background"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {student.present ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
                      {student.username
                        ? student.username.toUpperCase()
                        : student.name}
                    </span>
                    {student.username && (
                      <span className="text-xs text-muted-foreground">
                        {student.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {student.email}
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={
                  student.present
                    ? "bg-green-100/70 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-800 text-xs px-2.5 py-0.5"
                    : "text-muted-foreground text-xs px-2.5 py-0.5 border-dashed"
                }
              >
                {student.present ? "Present" : "Absent"}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Posting Attendance */}
      <AlertDialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Post Attendance & Lock Out Absent Students?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                <p>
                  Posting attendance activates strict exam security. Currently,{" "}
                  <span className="font-semibold text-foreground">
                    {presentCount} of {totalCount}
                  </span>{" "}
                  students are marked present.
                </p>
                <p className="font-medium text-destructive">
                  {totalCount - presentCount} absent student
                  {totalCount - presentCount !== 1 ? "s" : ""} will receive an
                  &quot;Attendance Lockout&quot; screen and will not be able to start or
                  continue the exam.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can still modify and update attendance at any time after posting.
                </p>
              </div>
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
              Confirm & Post Attendance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
