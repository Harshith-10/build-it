"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Users, Award, Search, ClipboardList } from "lucide-react";
import { getExerciseSubmissions, getExerciseAttendance, getAvailableSectionsForExercise } from "@/app/(faculty)/faculty/labs/labs";
import { awardMarks } from "@/actions/admin/labs";
import { downloadSubmissionsExcel } from "@/lib/download-submissions-excel";
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
  marks: number | null;
  implementationMarks: number | null;
  writeUpMarks: number | null;
  vivaMarks: number | null;
};

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
  const [savingId, setSavingId] = useState<string | null>(null);

  const [assignedGroups, setAssignedGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const fetchData = (groupIdFilter?: string) => {
    const filter = groupIdFilter !== undefined ? groupIdFilter : selectedGroupId;
    setLoading(true);

    if (!filter) {
      getAvailableSectionsForExercise(exerciseId)
        .then((sectionGroups) => {
          setAssignedGroups(sectionGroups);
          setData(null);
          setAttendanceData(null);
        })
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      getExerciseSubmissions(exerciseId, filter),
      getExerciseAttendance(exerciseId, filter),
      getAvailableSectionsForExercise(exerciseId),
    ])
      .then(([res, attRes, sectionGroups]) => {
        if (res.success && res.data) {
          const students = res.data.students as Student[];
          setData({ programs: res.data.exercise.programs, students });

          // Pre-populate inputs with existing marks
          const initial: Record<string, { writeUp: string; viva: string }> = {};
          for (const s of students) {
            initial[s.id] = {
              writeUp: s.writeUpMarks !== null ? String(s.writeUpMarks) : "",
              viva: s.vivaMarks !== null ? String(s.vivaMarks) : "",
            };
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
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
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

  const handleSaveMark = async (student: Student) => {
    const totalProgs = data?.programs.length ?? 0;
    const solvedCount = student.solvedProgramIds.length;
    const implScore = totalProgs > 0 ? (solvedCount / totalProgs) * 12 : 0;

    const writeUpRaw = marksInput[student.id]?.writeUp ?? "";
    const vivaRaw = marksInput[student.id]?.viva ?? "";

    const writeUp = parseFloat(writeUpRaw);
    const viva = parseFloat(vivaRaw);

    if (isNaN(writeUp) || writeUp < 0 || writeUp > 4) {
      toast.error("Please enter a valid Write-Up marks value (0 to 4).");
      return;
    }
    if (isNaN(viva) || viva < 0 || viva > 4) {
      toast.error("Please enter a valid Viva-Voce marks value (0 to 4).");
      return;
    }

    setSavingId(student.id);
    try {
      const res = await awardMarks({
        studentId: student.id,
        exerciseId,
        implementationMarks: implScore,
        writeUpMarks: writeUp,
        vivaMarks: viva,
      });
      if (res.success) {
        toast.success(`Marks saved for ${student.name}.`);
        setData((prev) =>
          prev
            ? {
                ...prev,
                students: prev.students.map((s) =>
                  s.id === student.id
                    ? { ...s, implementationMarks: implScore, writeUpMarks: writeUp, vivaMarks: viva, marks: implScore + writeUp + viva }
                    : s
                ),
              }
            : prev
        );
      } else {
        toast.error(res.error ?? "Failed to save marks.");
      }
    } finally {
      setSavingId(null);
    }
  };

  const setWriteUp = (studentId: string, value: string) =>
    setMarksInput((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { writeUp: "", viva: "" }), writeUp: value },
    }));

  const setViva = (studentId: string, value: string) =>
    setMarksInput((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { writeUp: "", viva: "" }), viva: value },
    }));

  const filteredStudents = data?.students.filter((student) => {
    const rollNo = student.username ?? "";
    return rollNo.toLowerCase().includes(searchQuery.toLowerCase());
  }) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pr-8 shrink-0 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            {awardMode ? (
              <Award className="h-4 w-4 text-amber-500" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Exercise {exerciseNo} — {exerciseTitle}
          </DialogTitle>
          <DialogDescription>
            {awardMode
              ? "Implementation is calculated out of 12. Enter Write-Up (max 4) and Viva-Voce (max 4) marks per student."
              : "Manage student submissions and attendance for this exercise"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
              {!awardMode && (
                <TabsList>
                  <TabsTrigger value="submissions" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Submissions
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex items-center gap-1.5">
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
                  <h3 className="text-lg font-medium">No Submissions Yet</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    No students have submitted programs for this exercise yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search Input & Download Excel */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search Roll No..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-sm h-9"
                      />
                    </div>
                    {data && data.students.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="gap-1.5 shrink-0"
                      >
                        <Download className="h-4 w-4" />
                        Download Submissions Excel
                      </Button>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">Roll No.</TableHead>
                          {!awardMode ? (
                            data.programs.map((p) => (
                              <TableHead
                                key={p.id}
                                className="text-center text-xs"
                                title={p.title}
                              >
                                P{p.programNo}
                              </TableHead>
                            ))
                          ) : (
                            <>
                              <TableHead className="text-center">Solved</TableHead>
                              <TableHead className="text-center">Implementation (max 12)</TableHead>
                              <TableHead className="text-center">Write-Up (max 4)</TableHead>
                              <TableHead className="text-center">Viva-Voce (max 4)</TableHead>
                              <TableHead className="text-center">Total (max 20)</TableHead>
                              <TableHead />
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

                          const writeUpNum = parseFloat(input.writeUp);
                          const vivaNum = parseFloat(input.viva);
                          const previewTotal =
                            !isNaN(writeUpNum) && !isNaN(vivaNum)
                              ? implScore + writeUpNum + vivaNum
                              : null;

                          return (
                            <TableRow key={student.id}>
                              {/* Roll Number */}
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {student.username ?? "—"}
                                </Badge>
                              </TableCell>

                              {!awardMode ? (
                                /* Per-program solved indicators (view mode only) */
                                data.programs.map((p) => {
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
                                })
                              ) : (
                                <>
                                  {/* Solved count */}
                                  <TableCell className="text-center">
                                    <Badge variant="outline">
                                      {solvedCount}/{totalProgs}
                                    </Badge>
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
                                      type="number"
                                      min={0}
                                      max={4}
                                      step="0.5"
                                      placeholder="0-4"
                                      value={input.writeUp}
                                      onChange={(e) => setWriteUp(student.id, e.target.value)}
                                      className="h-7 w-20 text-xs text-center px-1 mx-auto"
                                    />
                                  </TableCell>

                                  {/* Viva-Voce */}
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={4}
                                      step="0.5"
                                      placeholder="0-4"
                                      value={input.viva}
                                      onChange={(e) => setViva(student.id, e.target.value)}
                                      className="h-7 w-20 text-xs text-center px-1 mx-auto"
                                    />
                                  </TableCell>

                                  {/* Total */}
                                  <TableCell className="text-center">
                                    <span className="text-sm font-semibold tabular-nums">
                                      {previewTotal !== null ? (previewTotal % 1 === 0 ? previewTotal.toString() : previewTotal.toFixed(1)) : "—"}
                                    </span>
                                  </TableCell>

                                  {/* Save button */}
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-3 text-xs"
                                      disabled={savingId === student.id}
                                      onClick={() => handleSaveMark(student)}
                                    >
                                      {savingId === student.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        "Save"
                                      )}
                                    </Button>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={!awardMode ? data.programs.length + 1 : 7}
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
  );
}