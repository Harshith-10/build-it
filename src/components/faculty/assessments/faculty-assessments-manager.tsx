"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  Eye,
  FileCode2,
  FlaskConical,
  Folder,
  Key,
  Layers,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  deleteAssessmentSubmission,
  getAssessmentSubmissions,
  getFacultyAssessments,
  scheduleAssessmentForSection,
} from "@/actions/faculty/assessments";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatLocalDateTime, getLocalTimeZoneName } from "@/lib/date-time";

type FacultyAssessmentItem = Awaited<
  ReturnType<typeof getFacultyAssessments>
>[number];

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  const zone = getLocalTimeZoneName(date);
  const formatted = formatLocalDateTime(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  return zone ? `${formatted} ${zone}` : formatted;
}

export function FacultyAssessmentsManager() {
  const [assessments, setAssessments] = useState<FacultyAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<
    "lab_assessment" | "coding_assessment"
  >("lab_assessment");
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  // Schedule Modal state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingTarget, setSchedulingTarget] = useState<{
    assessment: FacultyAssessmentItem;
    group: FacultyAssessmentItem["assignedGroups"][number];
  } | null>(null);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Submissions Modal state
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [selectedAssessmentForSubs, setSelectedAssessmentForSubs] =
    useState<FacultyAssessmentItem | null>(null);
  const [selectedGroupForSubs, setSelectedGroupForSubs] = useState<
    FacultyAssessmentItem["assignedGroups"][number] | null
  >(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [deleteSubTargetId, setDeleteSubTargetId] = useState<string | null>(
    null,
  );
  const [deletingSub, setDeletingSub] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  async function loadAssessments() {
    try {
      setLoading(true);
      const data = await getFacultyAssessments();
      setAssessments(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assigned assessments");
    } finally {
      setLoading(false);
    }
  }

  // Filter assessments by category
  const labAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "lab_assessment"),
    [assessments],
  );

  const codingAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "coding_assessment"),
    [assessments],
  );

  // Unique lab subject folders
  const labFolders = useMemo(() => {
    const labMap = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string | null;
        description?: string | null;
        assessments: FacultyAssessmentItem[];
        activeCount: number;
      }
    >();

    labAssessments.forEach((item) => {
      const labId = item.labId || "unassigned";
      const labName = item.lab?.name || "General Lab Assessments";
      const labCode = item.lab?.code || null;
      const labDesc = (item.lab as any)?.description || item.description || null;

      if (!labMap.has(labId)) {
        labMap.set(labId, {
          id: labId,
          name: labName,
          code: labCode,
          description: labDesc,
          assessments: [],
          activeCount: 0,
        });
      }
      const entry = labMap.get(labId)!;
      entry.assessments.push(item);
      const hasActive = item.assignedGroups.some(
        (g) => g.slotStatus === "active",
      );
      if (hasActive) entry.activeCount++;
    });

    return Array.from(labMap.values());
  }, [labAssessments]);

  const selectedLab = useMemo(() => {
    if (!selectedLabId) return null;
    return labFolders.find((f) => f.id === selectedLabId) || null;
  }, [selectedLabId, labFolders]);

  const displayedAssessments = useMemo(() => {
    if (selectedCategory === "lab_assessment") {
      return selectedLabId
        ? labAssessments.filter(
            (a) => (a.labId || "unassigned") === selectedLabId,
          )
        : [];
    }
    return codingAssessments;
  }, [selectedCategory, selectedLabId, labAssessments, codingAssessments]);

  function openScheduleDialog(
    assessment: FacultyAssessmentItem,
    group?: FacultyAssessmentItem["assignedGroups"][number],
  ) {
    const targetGroup = group || assessment.assignedGroups[0];
    if (!targetGroup) {
      toast.error("No section assigned to schedule");
      return;
    }

    setSchedulingTarget({ assessment, group: targetGroup });

    const toInputFormat = (d: Date | null | undefined) => {
      if (!d) return "";
      const date = new Date(d);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    setStartTimeInput(toInputFormat(targetGroup.startTime));
    setEndTimeInput(toInputFormat(targetGroup.endTime));
    setPinInput(targetGroup.pin || "");
    setScheduleOpen(true);
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!schedulingTarget) return;

    if (!startTimeInput || !endTimeInput) {
      toast.error("Please provide both start and end time");
      return;
    }

    const startDate = new Date(startTimeInput);
    const endDate = new Date(endTimeInput);
    if (endDate <= startDate) {
      toast.error("End date and time must be strictly after Start date and time");
      return;
    }

    try {
      setSubmittingSchedule(true);
      const res = await scheduleAssessmentForSection({
        assessmentId: schedulingTarget.assessment.id,
        groupId: schedulingTarget.group.groupId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        pin: pinInput.trim() || null,
      });

      if (res.success) {
        toast.success(
          `Schedule updated for ${schedulingTarget.group.groupName}`,
        );
        setScheduleOpen(false);
        loadAssessments();
      } else {
        toast.error(res.error || "Failed to update schedule");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update schedule");
    } finally {
      setSubmittingSchedule(false);
    }
  }

  async function openSubmissionsModal(
    assessment: FacultyAssessmentItem,
    group?: FacultyAssessmentItem["assignedGroups"][number],
  ) {
    setSelectedAssessmentForSubs(assessment);
    setSelectedGroupForSubs(group || null);
    setSubSearchQuery("");
    setSubmissionsOpen(true);
    setLoadingSubmissions(true);
    try {
      const data = await getAssessmentSubmissions({
        assessmentId: assessment.id,
        groupId: group?.groupId,
      });
      setSubmissionsList(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function handleDeleteSubmission() {
    if (!deleteSubTargetId) return;
    try {
      setDeletingSub(true);
      const res = await deleteAssessmentSubmission(deleteSubTargetId);
      if (res.success) {
        toast.success("Student submission deleted (attempt reset)");
        setSubmissionsList((prev) =>
          prev.filter((s) => s.id !== deleteSubTargetId),
        );
      } else {
        toast.error(res.error || "Failed to delete submission");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete submission");
    } finally {
      setDeletingSub(false);
      setDeleteSubTargetId(null);
    }
  }

  const filteredSubmissions = useMemo(() => {
    if (!subSearchQuery.trim()) return submissionsList;
    const q = subSearchQuery.toLowerCase().trim();
    return submissionsList.filter(
      (s) =>
        s.user?.name?.toLowerCase().includes(q) ||
        s.user?.username?.toLowerCase().includes(q) ||
        s.user?.email?.toLowerCase().includes(q) ||
        s.user?.section?.toLowerCase().includes(q),
    );
  }, [submissionsList, subSearchQuery]);

  return (
    <div className="flex flex-col gap-5 max-w-6xl w-full">
      {/* ─── 1. TOP CATEGORY SWITCHER ────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border w-fit">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("lab_assessment");
              setSelectedLabId(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === "lab_assessment"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5 text-violet-500" />
            Lab Assessments
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-normal">
              {labAssessments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory("coding_assessment");
              setSelectedLabId(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === "coding_assessment"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-cyan-500" />
            Coding Assessments
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-normal">
              {codingAssessments.length}
            </span>
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAssessments}
          disabled={loading}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* ─── 2. LAB CARDS GRID (FIRST PAGE / ROOT VIEW) ──────────────────── */}
      {selectedCategory === "lab_assessment" && !selectedLabId && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {labFolders.length} lab subject{labFolders.length !== 1 ? "s" : ""}
            </p>
          </div>

          {labFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <FlaskConical className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No lab assessments assigned
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You have not been assigned to any lab assessments yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {labFolders.map((lab) => (
                <div
                  key={lab.id}
                  onClick={() => setSelectedLabId(lab.id)}
                  className="border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer min-w-0 bg-card"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-sm break-words">
                            {lab.name}
                          </span>
                          {lab.code && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 font-normal">
                              {lab.code}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {lab.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {lab.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t text-xs text-muted-foreground">
                    <span>
                      {lab.assessments.length} assessment{lab.assessments.length !== 1 ? "s" : ""}
                    </span>
                    {lab.activeCount > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {lab.activeCount} active now
                      </span>
                    ) : (
                      <span className="group-hover:text-foreground">Open Lab &rarr;</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 3. INSIDE LAB OR CODING ASSESSMENTS VIEW (MATCHES LAB UI) ──── */}
      {(selectedCategory === "coding_assessment" || (selectedCategory === "lab_assessment" && selectedLabId)) && (
        <div className="flex flex-col gap-3">
          {/* Breadcrumb Header */}
          {selectedCategory === "lab_assessment" && selectedLab && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <button
                type="button"
                onClick={() => setSelectedLabId(null)}
                className="hover:text-foreground hover:underline transition-colors"
              >
                Lab Assessments
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium truncate">
                {selectedLab.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {displayedAssessments.length} assessment{displayedAssessments.length !== 1 ? "s" : ""}
            </p>
          </div>

          {displayedAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <ClipboardList className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No assessments found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No assessments scheduled in this section.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayedAssessments.map((assessment, index) => {
                const groups = assessment.assignedGroups ?? [];
                const activeGroup = groups.find((g) => g.slotStatus === "active");
                const upcomingGroup = groups.find((g) => g.slotStatus === "upcoming");
                const targetGroup = activeGroup || upcomingGroup || groups[0];

                const isSlotActive = !!activeGroup;
                const isSlotUpcoming = !!upcomingGroup;
                const hasSchedule = !!(targetGroup?.startTime && targetGroup?.endTime);

                return (
                  <div
                    key={assessment.id}
                    className="border rounded-lg p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:border-primary/50 transition-colors bg-card min-w-0"
                  >
                    {/* Number Icon Box */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-semibold shrink-0 text-foreground">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-foreground break-words">
                            {assessment.title}
                          </p>
                        </div>

                        {/* Schedule & Section info */}
                        {hasSchedule && targetGroup ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {formatDate(targetGroup.startTime)} → {formatDate(targetGroup.endTime)}
                            </span>
                            {isSlotActive && (
                              <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            Not scheduled
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side: Badge & Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isSlotActive ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-normal"
                        >
                          Active
                        </Badge>
                      ) : isSlotUpcoming ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-normal"
                        >
                          Upcoming
                        </Badge>
                      ) : hasSchedule ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 font-normal"
                        >
                          Ended
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground font-normal"
                        >
                          Not Scheduled
                        </Badge>
                      )}

                      {/* Icon Action Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View submissions"
                          onClick={() => openSubmissionsModal(assessment, targetGroup)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Schedule time window"
                          onClick={() => openScheduleDialog(assessment, targetGroup)}
                        >
                          <Clock className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── SCHEDULE WINDOW MODAL ────────────────────────────────────────────── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Schedule Assessment Window
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set the active start and end time window for{" "}
              <span className="font-medium text-foreground">
                {schedulingTarget?.group.groupName}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSchedule} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-xs">
                Start Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-time" className="text-xs">
                End Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTimeInput}
                onChange={(e) => setEndTimeInput(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-pin" className="text-xs">
                Section Access PIN (Optional)
              </Label>
              <Input
                id="sec-pin"
                placeholder="e.g. 849201"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                If set, students must enter this PIN before beginning the assessment.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScheduleOpen(false)}
                disabled={submittingSchedule}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingSchedule}
                className="text-xs"
              >
                {submittingSchedule && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                )}
                Save Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── SUBMISSIONS MODAL WITH STUDENT SEARCH & ATTEMPT DELETION ────────── */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                Submissions: {selectedAssessmentForSubs?.title}
              </DialogTitle>
              <Badge variant="secondary" className="font-mono text-xs w-fit">
                {submissionsList.length} Student{submissionsList.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <DialogDescription className="text-xs sm:text-sm">
              Review student scores, timestamps, and delete individual student submissions to reset attempts.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar for submissions */}
          <div className="relative pt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by student name, roll number, email, or section..."
              value={subSearchQuery}
              onChange={(e) => setSubSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/20"
            />
            {subSearchQuery && (
              <button
                type="button"
                onClick={() => setSubSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs sm:text-sm">Loading submissions...</span>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs sm:text-sm">
                {subSearchQuery
                  ? "No submissions match your search filter."
                  : "No submissions recorded for this assessment yet."}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 sm:p-3.5 rounded-lg border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm text-foreground">
                          {sub.user?.name || "Student"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({sub.user?.username || sub.user?.email})
                        </span>
                        {sub.user?.section && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            Sec {sub.user.section}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground pt-1">
                        <span>
                          Status:{" "}
                          <span className="font-medium text-foreground capitalize">
                            {sub.status?.replace("_", " ")}
                          </span>
                        </span>
                        <span>
                          Score:{" "}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {sub.score ?? 0}
                          </span>
                        </span>
                        {sub.malpracticeCount > 0 && (
                          <span className="text-destructive font-medium">
                            Alerts: {sub.malpracticeCount}
                          </span>
                        )}
                        <span className="text-[11px]">
                          {formatDate(sub.completedAt || sub.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteSubTargetId(sub.id)}
                      className="text-destructive hover:bg-destructive/10 border-destructive/20 text-xs gap-1.5 h-8 shrink-0 self-end sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Submission
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setSubmissionsOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CONFIRM RESET ATTEMPT MODAL ──────────────────────────────────────── */}
      <AlertDialog
        open={Boolean(deleteSubTargetId)}
        onOpenChange={(open) => !open && setDeleteSubTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete Student Submission?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Deleting this submission will permanently clear this student's
              recorded answers, score, and malpractice flags, allowing them to
              retake the assessment from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSub} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              disabled={deletingSub}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {deletingSub && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              )}
              Delete & Reset Attempt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
