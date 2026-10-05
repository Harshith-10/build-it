"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Circle, Download, Loader2, Users, Award, Search, ClipboardList, Trash2, Check, RotateCcw, Save } from "lucide-react";
import { getExerciseSubmissions, getExerciseAttendance, getAvailableSectionsForExercise } from "@/app/(faculty)/faculty/labs/labs";
import { awardBatchMarks, deleteLabSubmission, deleteSectionLabSubmissions, resetSectionMarks } from "@/actions/admin/labs";
import { downloadSubmissionsExcel } from "@/lib/download-submissions-excel";
import { DownloadReportButton } from "@/components/labs/download-report-button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendancePanel } from "@/app/(faculty)/faculty/labs/[labId]/[exerciseId]/attendance-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  /** When true, shows editable Write-Up + Viva inputs (Implementation is auto-calculated) with Save buttons */
  awardMode?: boolean;
  defaultTab?: "submissions" | "attendance";
}

type Student = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  solvedProgramIds: string[];
  vivaSubmittedCount?: number;
  marks: number | null;
  implementationMarks: number | null;
  writeUpMarks: number | null;
  vivaMarks: number | null;
};

function clampNaturalMark(val: string): string {
  if (val === "") return "";
  // Strip decimals and non-digits; take portion before any decimal point
  const intPart = val.split(".")[0].replace(/\D/g, "");
  if (!intPart) return "";
  const num = parseInt(intPart, 10);
  if (isNaN(num)) return "";
  if (num > 4) return "4";
  if (num < 0) return "0";
  return String(num);
}

export function ExerciseSubmissionsDialog({
  open,
  onClose,
  exerciseId,
  exerciseTitle,
  exerciseNo,
  awardMode = false,
  defaultTab = "submissions",
}: ExerciseSubmissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<{
    programs: { id: string; programNo: number; title: string }[];
    students: Student[];
  } | null>(null);

  const [attendanceData, setAttendanceData] = useState<{
    students: { id: string; name: string; email: string; username: string | null; present: boolean }[];
    attendancePosted: boolean;
  } | null>(null);

  // Per-student editable marks: { [studentId]: { writeUp: string, viva: string } }
  const [marksInput, setMarksInput] = useState<
    Record<string, { writeUp: string; viva: string }>
  >({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMarks, setDraftMarks] = useState<Record<string, { writeUp: string; viva: string }> | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmResetMarksOpen, setConfirmResetMarksOpen] = useState(false);
  const [isResettingMarks, setIsResettingMarks] = useState(false);

  const getDraftKey = (gid: string) => `lab_marks_draft_${exerciseId}_${gid}`;

  const [assignedGroups, setAssignedGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [confirmSectionDeleteOpen, setConfirmSectionDeleteOpen] = useState(false);
  const [isDeletingSection, setIsDeletingSection] = useState(false);
  const fetchSeqRef = useRef(0);

  const selectedGroup = assignedGroups.find((g) => g.id === selectedGroupId);
  const hasAnySubmissions =
    data?.students.some(
      (s) =>
        s.solvedProgramIds.length > 0 ||
        (s.vivaSubmittedCount ?? 0) > 0 ||
        s.marks !== null
    ) ?? false;

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      const res = await deleteLabSubmission({
        exerciseId,
        studentId: studentToDelete.id,
      });
      if (res.success) {
        toast.success(`Submission deleted for ${studentToDelete.name}.`);
        setData((prev) =>
          prev
            ? {
                ...prev,
                students: prev.students.map((s) =>
                  s.id === studentToDelete.id
                    ? {
                        ...s,
                        solvedProgramIds: [],
                        vivaSubmittedCount: 0,
                        marks: null,
                        implementationMarks: null,
                        writeUpMarks: null,
                        vivaMarks: null,
                      }
                    : s
                ),
              }
            : prev
        );
        setMarksInput((prev) => ({
          ...prev,
          [studentToDelete.id]: { writeUp: "", viva: "" },
        }));
        setStudentToDelete(null);
      } else {
        toast.error(res.error || "Failed to delete submission.");
      }
    } catch (error) {
      console.error("Failed to delete student submission:", error);
      toast.error("An error occurred while deleting submission.");
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!selectedGroupId) return;
    setIsDeletingSection(true);
    try {
      const res = await deleteSectionLabSubmissions({
        exerciseId,
        groupId: selectedGroupId,
      });
      if (res.success) {
        toast.success("All submissions for this section have been deleted.");
        setConfirmSectionDeleteOpen(false);
        fetchData(selectedGroupId);
      } else {
        toast.error(res.error || "Failed to delete section submissions.");
      }
    } catch (error) {
      console.error("Failed to delete section submissions:", error);
      toast.error("An error occurred while deleting section submissions.");
    } finally {
      setIsDeletingSection(false);
    }
  };

  const fetchData = (groupIdFilter?: string) => {
    const filter = groupIdFilter !== undefined ? groupIdFilter : selectedGroupId;
    const currentSeq = ++fetchSeqRef.current;
    setLoading(true);

    if (!filter) {
      getAvailableSectionsForExercise(exerciseId)
        .then((sectionGroups) => {
          if (currentSeq !== fetchSeqRef.current) return;
          setAssignedGroups(sectionGroups);
          setData(null);
          setAttendanceData(null);
        })
        .finally(() => {
          if (currentSeq === fetchSeqRef.current) {
            setLoading(false);
          }
        });
      return;
    }

    Promise.all([
      getExerciseSubmissions(exerciseId, filter),
      getExerciseAttendance(exerciseId, filter),
      getAvailableSectionsForExercise(exerciseId),
    ])
      .then(([res, attRes, sectionGroups]) => {
        if (currentSeq !== fetchSeqRef.current) return;
        if (res.success && res.data) {
          const students = res.data.students as Student[];
          setData({ programs: res.data.exercise.programs, students });

          // Pre-populate inputs with existing marks
          const initial: Record<string, { writeUp: string; viva: string }> = {};
          for (const s of students) {
            initial[s.id] = {
              writeUp: s.writeUpMarks !== null ? clampNaturalMark(String(s.writeUpMarks)) : "",
              viva: s.vivaMarks !== null ? clampNaturalMark(String(s.vivaMarks)) : "",
            };
          }

          // Check if an unsaved draft exists in localStorage for this section
          if (filter) {
            try {
              const draftKey = `lab_marks_draft_${exerciseId}_${filter}`;
              const draftStr = localStorage.getItem(draftKey);
              if (draftStr) {
                const parsed = JSON.parse(draftStr) as Record<string, { writeUp: string; viva: string }>;
                let hasDifference = false;
                for (const s of students) {
                  const d = parsed[s.id];
                  const cur = initial[s.id];
                  if (d && (d.writeUp !== cur.writeUp || d.viva !== cur.viva)) {
                    hasDifference = true;
                    break;
                  }
                }
                if (hasDifference) {
                  setHasDraft(true);
                  setDraftMarks(parsed);
                } else {
                  localStorage.removeItem(draftKey);
                  setHasDraft(false);
                  setDraftMarks(null);
                }
              } else {
                setHasDraft(false);
                setDraftMarks(null);
              }
            } catch {
              setHasDraft(false);
              setDraftMarks(null);
            }
          }

          setMarksInput(initial);
        }
        if (attRes.success && attRes.data) {
          setAttendanceData(attRes.data);
        }
        if (sectionGroups) {
          setAssignedGroups(sectionGroups);
        }
      })
      .finally(() => {
        if (currentSeq === fetchSeqRef.current) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    if (!open) {
      fetchSeqRef.current++;
      return;
    }
    setSelectedGroupId("");
    setData(null);
    setAttendanceData(null);
    fetchData("");
  }, [open, exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = () => {
    if (!data) return;
    downloadSubmissionsExcel({
      exerciseNo,
      exerciseTitle,
      programs: data.programs,
      students: data.students,
    });
  };

  const handleApplyDraft = () => {
    if (draftMarks) {
      setMarksInput((prev) => ({ ...prev, ...draftMarks }));
      toast.success("Draft marks restored from previous session.");
    }
    setHasDraft(false);
  };

  const handleDiscardDraft = () => {
    if (selectedGroupId) {
      localStorage.removeItem(getDraftKey(selectedGroupId));
    }
    if (data) {
      const resetMarks: Record<string, { writeUp: string; viva: string }> = {};
      for (const s of data.students) {
        resetMarks[s.id] = {
          writeUp: s.writeUpMarks !== null ? clampNaturalMark(String(s.writeUpMarks)) : "",
          viva: s.vivaMarks !== null ? clampNaturalMark(String(s.vivaMarks)) : "",
        };
      }
      setMarksInput(resetMarks);
    }
    setHasDraft(false);
    setDraftMarks(null);
    toast.info("Draft discarded. Showing saved marks.");
  };

  const handleResetSectionMarks = async () => {
    if (!selectedGroupId) return;
    setIsResettingMarks(true);
    try {
      const res = await resetSectionMarks({
        exerciseId,
        groupId: selectedGroupId,
      });
      if (res.success) {
        toast.success(`Marks for ${selectedGroup?.name ?? "this section"} have been reset.`);
        setConfirmResetMarksOpen(false);
        localStorage.removeItem(getDraftKey(selectedGroupId));
        setHasDraft(false);
        setDraftMarks(null);
        const cleared: Record<string, { writeUp: string; viva: string }> = {};
        if (data) {
          for (const s of data.students) {
            cleared[s.id] = { writeUp: "", viva: "" };
          }
        }
        setMarksInput(cleared);
        fetchData(selectedGroupId);
      } else {
        toast.error(res.error || "Failed to reset section marks.");
      }
    } catch (error) {
      console.error("Failed to reset section marks:", error);
      toast.error("An error occurred while resetting section marks.");
    } finally {
      setIsResettingMarks(false);
    }
  };

  const handleInputChange = (studentId: string, field: "writeUp" | "viva", rawVal: string) => {
    const val = clampNaturalMark(rawVal);
    const current = marksInput[studentId] ?? { writeUp: "", viva: "" };
    const updated = {
      ...current,
      [field]: val,
    };
    const nextMarks = {
      ...marksInput,
      [studentId]: updated,
    };
    setMarksInput(nextMarks);

    // Sync draft in real-time to localStorage for this section
    if (selectedGroupId) {
      try {
        localStorage.setItem(getDraftKey(selectedGroupId), JSON.stringify(nextMarks));
      } catch {
        // ignore quota
      }
    }
  };

  const changedStudents = data?.students.filter((student) => {
    const current = marksInput[student.id];
    if (!current) return false;
    const dbWriteUp = student.writeUpMarks !== null ? String(student.writeUpMarks) : "";
    const dbViva = student.vivaMarks !== null ? String(student.vivaMarks) : "";
    return current.writeUp !== dbWriteUp || current.viva !== dbViva;
  }) ?? [];

  const changedStudentsCount = changedStudents.length;

  const handleSaveBatch = async () => {
    if (!selectedGroupId || !data) return;
    const totalProgs = data.programs.length;

    const marksToSave: {
      studentId: string;
      implementationMarks: number;
      writeUpMarks: number;
      vivaMarks: number;
    }[] = [];

    for (const student of data.students) {
      const inp = marksInput[student.id];
      if (!inp) continue;
      if (inp.writeUp === "" && inp.viva === "") continue;

      const wNum = parseInt(inp.writeUp, 10);
      const vNum = parseInt(inp.viva, 10);

      if (isNaN(wNum) || wNum < 0 || wNum > 4) {
        toast.error(`Please enter a valid Write-Up mark (0-4) for ${student.name || student.username}.`);
        return;
      }
      if (isNaN(vNum) || vNum < 0 || vNum > 4) {
        toast.error(`Please enter a valid Viva-Voce mark (0-4) for ${student.name || student.username}.`);
        return;
      }

      if (student.writeUpMarks !== wNum || student.vivaMarks !== vNum) {
        const solvedCount = student.solvedProgramIds.length;
        const implScore = totalProgs > 0 ? (solvedCount / totalProgs) * 12 : 0;
        marksToSave.push({
          studentId: student.id,
          implementationMarks: implScore,
          writeUpMarks: wNum,
          vivaMarks: vNum,
        });
      }
    }

    if (marksToSave.length === 0) {
      toast.info("No unsaved changes to save.");
      return;
    }

    setIsSavingBatch(true);
    try {
      const res = await awardBatchMarks({
        exerciseId,
        groupId: selectedGroupId,
        marks: marksToSave,
      });

      if (res.success) {
        toast.success(
          `Successfully saved marks for ${res.count ?? marksToSave.length} student${(res.count ?? marksToSave.length) > 1 ? "s" : ""}.`
        );
        if (selectedGroupId) {
          localStorage.removeItem(getDraftKey(selectedGroupId));
        }
        setHasDraft(false);
        setDraftMarks(null);

        const savedMap = new Map(marksToSave.map((m) => [m.studentId, m]));
        setData((prev) =>
          prev
            ? {
                ...prev,
                students: prev.students.map((s) => {
                  const saved = savedMap.get(s.id);
                  if (saved) {
                    return {
                      ...s,
                      implementationMarks: saved.implementationMarks,
                      writeUpMarks: saved.writeUpMarks,
                      vivaMarks: saved.vivaMarks,
                      marks: saved.implementationMarks + saved.writeUpMarks + saved.vivaMarks,
                    };
                  }
                  return s;
                }),
              }
            : prev
        );
      } else {
        toast.error(res.error || "Failed to save marks.");
      }
    } catch (e) {
      console.error("Batch save failed:", e);
      toast.error("An error occurred while saving marks.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleRequestClose = () => {
    if (awardMode && changedStudentsCount > 0) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  };

  const filteredStudents = data?.students.filter((student) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const rollNo = (student.username ?? "").toLowerCase();
    const name = (student.name ?? "").toLowerCase();
    const email = (student.email ?? "").toLowerCase();
    return rollNo.includes(q) || name.includes(q) || email.includes(q);
  }) ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleRequestClose()}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-[95vw] max-h-[88vh] flex flex-col overflow-hidden p-6 gap-0">
        <DialogHeader className="pr-8 shrink-0 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            {awardMode ? (
              <Award className="h-5 w-5 text-amber-500" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
            Exercise {exerciseNo} — {exerciseTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {awardMode
              ? "Implementation is calculated out of 12. Enter Write-Up (0-4) and Viva-Voce (0-4) marks per student, then click 'Save All Marks'."
              : "Manage student submissions and attendance for this exercise"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pt-4 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              {!awardMode && (
                <TabsList className="h-9">
                  <TabsTrigger value="submissions" className="flex items-center gap-1.5 text-xs px-3">
                    <Users className="h-3.5 w-3.5" />
                    Submissions
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex items-center gap-1.5 text-xs px-3">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Attendance
                    {attendanceData?.attendancePosted && (
                      <span className="h-2 w-2 rounded-full bg-green-500 ml-1 inline-block" />
                    )}
                  </TabsTrigger>
                </TabsList>
              )}

              {/* Section Selector */}
              {assignedGroups.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Section:</span>
                  <Select
                    value={selectedGroupId}
                    onValueChange={(val) => {
                      setSelectedGroupId(val);
                      fetchData(val);
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-xs font-semibold">
                      <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="submissions">
              {!selectedGroupId ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center my-4">
                  <div className="bg-muted mb-3 rounded-full p-3">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium">Select a Section</h3>
                  <p className="text-muted-foreground mt-1 text-xs max-w-sm">
                    Please select a section from the dropdown above to view submissions and award marks.
                  </p>
                </div>
              ) : !data || data.students.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="bg-muted mb-4 rounded-full p-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No Students Found</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    No students were found enrolled in this section.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search Input & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by Roll No, Name, or Email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-xs h-9 w-full"
                      />
                    </div>
                    {data && data.students.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {awardMode && data && data.students.length > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted/60 border text-xs font-medium mr-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span>
                              Graded:{" "}
                              <strong className="text-foreground font-semibold">
                                {data.students.filter((s) => s.writeUpMarks !== null && s.vivaMarks !== null).length}
                              </strong>{" "}
                              / {data.students.length}
                            </span>
                          </div>
                        )}
                        {awardMode && (
                          <Button
                            size="sm"
                            onClick={handleSaveBatch}
                            disabled={isSavingBatch || changedStudentsCount === 0}
                            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                          >
                            {isSavingBatch ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save All Marks {changedStudentsCount > 0 ? `(${changedStudentsCount})` : ""}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="gap-1.5 text-xs h-9"
                        >
                          <Download className="h-4 w-4" />
                          Download Excel
                        </Button>
                        {!awardMode ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmSectionDeleteOpen(true)}
                            disabled={!hasAnySubmissions}
                            className="gap-1.5 text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 disabled:opacity-50"
                            title="Delete all submissions for this section"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Section Submissions
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmResetMarksOpen(true)}
                            disabled={
                              data.students.filter((s) => s.writeUpMarks !== null || s.vivaMarks !== null).length === 0
                            }
                            className="gap-1.5 text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                            title="Reset all awarded marks for this section back to unawarded"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reset Section Marks
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Draft Banner */}
                  {awardMode && hasDraft && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-500">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 shrink-0" />
                        <span>
                          <strong>Unsaved draft found for {selectedGroup?.name ?? "this section"}:</strong> You have previously entered marks that were not saved to the cloud.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleApplyDraft}
                          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                        >
                          Continue with Draft
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleDiscardDraft}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                          Reset / Discard
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-left pl-4 font-semibold w-44">Roll No.</TableHead>
                          {!awardMode ? (
                            <>
                              {data.programs.map((p) => (
                                <TableHead
                                  key={p.id}
                                  className="text-center text-xs font-semibold"
                                  title={p.title}
                                >
                                  P{p.programNo}
                                </TableHead>
                              ))}
                              <TableHead className="text-center text-xs font-semibold">Viva Answers</TableHead>
                              <TableHead className="text-center text-xs font-semibold">Lab Report</TableHead>
                              <TableHead className="text-center w-24 pr-4 font-semibold">Action</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-center font-semibold text-xs">Solved</TableHead>
                              <TableHead className="text-center font-semibold text-xs">Implementation (max 12)</TableHead>
                              <TableHead className="text-center font-semibold text-xs">Write-Up (0-4)</TableHead>
                              <TableHead className="text-center font-semibold text-xs">Viva-Voce (0-4)</TableHead>
                              <TableHead className="text-center font-semibold text-xs">Total (max 20)</TableHead>
                              <TableHead className="text-center font-semibold text-xs">Student Report</TableHead>
                              <TableHead className="text-center w-20 pr-4 font-semibold text-xs">Status</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => {
                          const input = marksInput[student.id] ?? { writeUp: "", viva: "" };
                          
                          const totalProgs = data.programs.length;
                          const solvedCount = student.solvedProgramIds.length;
                          const implScore = totalProgs > 0 ? (solvedCount / totalProgs) * 12 : 0;

                          const writeUpNum = parseInt(input.writeUp, 10);
                          const vivaNum = parseInt(input.viva, 10);
                          const previewTotal =
                            !isNaN(writeUpNum) && !isNaN(vivaNum)
                              ? implScore + writeUpNum + vivaNum
                              : null;

                          const hasSubmittedContent =
                            solvedCount > 0 ||
                            (student.vivaSubmittedCount ?? 0) > 0 ||
                            student.marks !== null;

                          return (
                            <TableRow key={student.id}>
                              {/* Roll Number */}
                              <TableCell className="text-left pl-4">
                                <Badge variant="outline" className="text-xs font-mono tracking-wide px-2.5 py-0.5 font-medium">
                                  {student.username ?? "—"}
                                </Badge>
                              </TableCell>

                              {!awardMode ? (
                                /* Per-program solved indicators (view mode only) */
                                <>
                                  {data.programs.map((p) => {
                                    const solved = student.solvedProgramIds.includes(p.id);
                                    return (
                                      <TableCell key={p.id} className="text-center">
                                        {solved ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                        ) : (
                                          <Circle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                                        )}
                                      </TableCell>
                                    );
                                  })}

                                  {/* Viva Answers */}
                                  <TableCell className="text-center">
                                    {(student.vivaSubmittedCount ?? 0) > 0 ? (
                                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200">
                                        {student.vivaSubmittedCount} Answered
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>

                                  {/* Lab Report */}
                                  <TableCell className="text-center">
                                    {hasSubmittedContent ? (
                                      <DownloadReportButton
                                        exerciseId={exerciseId}
                                        studentId={student.id}
                                        size="sm"
                                        variant="outline"
                                        label="View Record"
                                        className="h-7 text-xs px-2"
                                      />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>

                                  {/* Action */}
                                  <TableCell className="text-center pr-4">
                                    {hasSubmittedContent ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        title={`Delete submission and reset for ${student.name || student.username}`}
                                        className="text-destructive hover:text-white bg-destructive/10 hover:bg-destructive/80 transition-colors mx-auto h-8 w-8"
                                        onClick={() => setStudentToDelete(student)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  {/* Solved count */}
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge variant="outline" className="text-xs">
                                        {solvedCount}/{totalProgs}
                                      </Badge>
                                      {(student.vivaSubmittedCount ?? 0) > 0 && (
                                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                          Viva: {student.vivaSubmittedCount} Ans
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Implementation (calculated and read-only) */}
                                  <TableCell className="text-center">
                                    <span className="text-sm font-medium">
                                      {implScore % 1 === 0 ? implScore.toString() : implScore.toFixed(1)}
                                    </span>
                                  </TableCell>

                                  {/* Write-Up */}
                                  <TableCell className="text-center">
                                    <Input
                                      id={`writeUp-${student.id}`}
                                      type="number"
                                      min={0}
                                      max={4}
                                      step={1}
                                      placeholder="0-4"
                                      value={input.writeUp}
                                      onKeyDown={(e) => {
                                        if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                                          e.preventDefault();
                                        }
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          document.getElementById(`viva-${student.id}`)?.focus();
                                        }
                                      }}
                                      onChange={(e) => handleInputChange(student.id, "writeUp", e.target.value)}
                                      className="h-7 w-20 text-xs text-center px-1 mx-auto"
                                    />
                                  </TableCell>

                                  {/* Viva-Voce */}
                                  <TableCell className="text-center">
                                    <Input
                                      id={`viva-${student.id}`}
                                      type="number"
                                      min={0}
                                      max={4}
                                      step={1}
                                      placeholder="0-4"
                                      value={input.viva}
                                      onKeyDown={(e) => {
                                        if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                                          e.preventDefault();
                                        }
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const currentIndex = filteredStudents.findIndex((s) => s.id === student.id);
                                          if (currentIndex !== -1 && currentIndex < filteredStudents.length - 1) {
                                            const nextStudent = filteredStudents[currentIndex + 1];
                                            document.getElementById(`writeUp-${nextStudent.id}`)?.focus();
                                          }
                                        }
                                      }}
                                      onChange={(e) => handleInputChange(student.id, "viva", e.target.value)}
                                      className="h-7 w-20 text-xs text-center px-1 mx-auto"
                                    />
                                  </TableCell>

                                  {/* Total */}
                                  <TableCell className="text-center">
                                    <span className="text-sm font-semibold tabular-nums">
                                      {previewTotal !== null ? (previewTotal % 1 === 0 ? previewTotal.toString() : previewTotal.toFixed(1)) : "—"}
                                    </span>
                                  </TableCell>

                                  {/* Download Student Report PDF */}
                                  <TableCell className="text-center">
                                    {hasSubmittedContent ? (
                                      <DownloadReportButton
                                        exerciseId={exerciseId}
                                        studentId={student.id}
                                        size="sm"
                                        variant="outline"
                                        label="View Record"
                                        className="h-7 text-xs px-2 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                                      />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>

                                  {/* Row Status */}
                                  <TableCell className="text-center pr-4">
                                    {(() => {
                                      const inp = marksInput[student.id];
                                      const isChanged =
                                        inp &&
                                        (inp.writeUp !== String(student.writeUpMarks ?? "") ||
                                          inp.viva !== String(student.vivaMarks ?? ""));

                                      if (isChanged && (inp.writeUp !== "" || inp.viva !== "")) {
                                        return (
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30 font-medium"
                                          >
                                            Unsaved
                                          </Badge>
                                        );
                                      }
                                      if (student.writeUpMarks !== null && student.vivaMarks !== null) {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                                            <Check className="h-3.5 w-3.5" />
                                            Saved
                                          </span>
                                        );
                                      }
                                      return <span className="text-muted-foreground/30 text-xs font-mono">—</span>;
                                    })()}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={!awardMode ? data.programs.length + 4 : 8}
                              className="text-center py-6 text-sm text-muted-foreground"
                            >
                              No matching students found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendance">
              {!selectedGroupId ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center my-4">
                  <div className="bg-muted mb-3 rounded-full p-3">
                    <ClipboardList className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium">Select a Section</h3>
                  <p className="text-muted-foreground mt-1 text-xs max-w-sm">
                    Please select a section from the dropdown above to manage and post attendance.
                  </p>
                </div>
              ) : (
                <AttendancePanel
                  exerciseId={exerciseId}
                  exerciseNo={exerciseNo}
                  exerciseTitle={exerciseTitle}
                  initialStudents={attendanceData?.students ?? []}
                  initialPosted={attendanceData?.attendancePosted ?? false}
                  groupId={selectedGroupId}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Individual Student Delete Confirmation Dialog */}
    <AlertDialog
      open={!!studentToDelete}
      onOpenChange={(open) => {
        if (!open && !isDeletingStudent) setStudentToDelete(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Student Submission?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the submission for{" "}
            <span className="font-semibold text-foreground">
              {studentToDelete?.name}
            </span>{" "}
            {studentToDelete?.username && (
              <span className="font-mono text-xs text-foreground">
                ({studentToDelete.username})
              </span>
            )}
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingStudent}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeletingStudent}
            onClick={(e) => {
              e.preventDefault();
              handleDeleteStudent();
            }}
          >
            {isDeletingStudent ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Submission"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Section Submissions Delete Confirmation Dialog */}
    <AlertDialog
      open={confirmSectionDeleteOpen}
      onOpenChange={(open) => {
        if (!open && !isDeletingSection) setConfirmSectionDeleteOpen(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Section Submissions?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete all submissions for section{" "}
            <span className="font-semibold text-foreground">
              {selectedGroup?.name ?? "this section"}
            </span>
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingSection}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeletingSection}
            onClick={(e) => {
              e.preventDefault();
              handleDeleteSection();
            }}
          >
            {isDeletingSection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete All Submissions"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Section Marks Reset Confirmation Dialog */}
    <AlertDialog
      open={confirmResetMarksOpen}
      onOpenChange={(open) => {
        if (!open && !isResettingMarks) setConfirmResetMarksOpen(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset All Section Marks?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reset all awarded marks for section{" "}
            <span className="font-semibold text-foreground">
              {selectedGroup?.name ?? "this section"}
            </span>
            ?
            <br />
            <br />
            All entered Write-Up and Viva-Voce marks for this section will be cleared back to unawarded.
            Student code submissions and attendance records will remain intact. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResettingMarks}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isResettingMarks}
            onClick={(e) => {
              e.preventDefault();
              handleResetSectionMarks();
            }}
          >
            {isResettingMarks ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset All Marks"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Unsaved Changes Close Confirmation Dialog */}
    <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Marks Detected</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved marks for{" "}
            <span className="font-semibold text-foreground">
              {changedStudentsCount} student{changedStudentsCount > 1 ? "s" : ""}
            </span>{" "}
            in section{" "}
            <span className="font-semibold text-foreground">
              {selectedGroup?.name ?? "this section"}
            </span>
            . Your edits are saved as a local draft on this device.
            <br />
            <br />
            Would you like to save them to the cloud now, or exit and continue later?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => setConfirmCloseOpen(false)}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            className="text-xs"
            onClick={() => {
              setConfirmCloseOpen(false);
              onClose();
            }}
          >
            Exit (Keep Draft)
          </Button>
          <Button
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSavingBatch}
            onClick={async () => {
              await handleSaveBatch();
              setConfirmCloseOpen(false);
              onClose();
            }}
          >
            Save All & Exit
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}