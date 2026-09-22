"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  FlaskConical,
  Folder,
  Key,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import {
  deleteAssessment,
  getAssessments,
  getAssessmentsSummary,
  getAvailableCollections,
  getAvailableFaculty,
  getAvailableGroups,
  getAvailableLabs,
  upsertAssessment,
  type UpsertAssessmentInput,
} from "@/actions/admin/assessments";
import { createLab } from "@/actions/admin/labs";
import {
  deleteAssessmentSubmission,
  getAssessmentSubmissions,
} from "@/actions/faculty/assessments";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatLocalDateTime, getLocalTimeZoneName } from "@/lib/date-time";

type AssessmentCategory = "lab_assessment" | "coding_assessment";

type AssessmentItem = Awaited<ReturnType<typeof getAssessments>>[number];
type SummaryData = Awaited<ReturnType<typeof getAssessmentsSummary>>;

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

function toDatetimeLocalString(date?: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getStatusBadge(status: "upcoming" | "active" | "ended") {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30">
          Active
        </Badge>
      );
    case "upcoming":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/30">
          Upcoming
        </Badge>
      );
    case "ended":
      return (
        <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-500/20 border-zinc-500/30">
          Ended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AssessmentsManager({ isAdmin = true }: { isAdmin?: boolean }) {
  const [selectedCategory, setSelectedCategory] =
    useState<AssessmentCategory>("lab_assessment");
  const [selectedLab, setSelectedLab] = useState<any | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [labSearchQuery, setLabSearchQuery] = useState("");

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [createLabOpen, setCreateLabOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] =
    useState<AssessmentItem | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Submissions dialog state
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [selectedAssessmentForSubs, setSelectedAssessmentForSubs] =
    useState<AssessmentItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionsSearchQuery, setSubmissionsSearchQuery] = useState("");
  const [deleteSubTargetId, setDeleteSubTargetId] = useState<string | null>(
    null,
  );

  // Lookups
  const [availableLabs, setAvailableLabs] = useState<any[]>([]);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [availableFaculty, setAvailableFaculty] = useState<any[]>([]);

  useEffect(() => {
    loadSummary();
    loadLookups();
  }, []);

  useEffect(() => {
    if (selectedCategory === "coding_assessment") {
      loadAssessmentsList("coding_assessment");
    } else if (selectedCategory === "lab_assessment" && selectedLab) {
      loadAssessmentsList("lab_assessment", selectedLab.id);
    }
  }, [selectedCategory, selectedLab]);

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      const data = await getAssessmentsSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assessments summary");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadLookups() {
    try {
      const [labs, collections, groups, faculty] = await Promise.all([
        getAvailableLabs(),
        getAvailableCollections(),
        getAvailableGroups(),
        getAvailableFaculty(),
      ]);
      setAvailableLabs(labs);
      setAvailableCollections(collections);
      setAvailableGroups(groups);
      setAvailableFaculty(faculty);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAssessmentsList(
    type: AssessmentCategory,
    labId?: string,
  ) {
    try {
      setLoadingList(true);
      const list = await getAssessments({
        type,
        search: searchQuery,
        labId: labId || (type === "lab_assessment" ? selectedLab?.id : undefined),
      });
      setAssessments(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assessments list");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleDeleteAssessment() {
    if (!deleteTargetId) return;
    try {
      const res = await deleteAssessment(deleteTargetId);
      if (res.success) {
        toast.success("Assessment deleted successfully");
        if (selectedCategory) {
          loadAssessmentsList(
            selectedCategory,
            selectedCategory === "lab_assessment" ? selectedLab?.id : undefined,
          );
        }
        loadSummary();
        loadLookups();
      } else {
        toast.error(res.error || "Failed to delete assessment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assessment");
    } finally {
      setDeleteTargetId(null);
    }
  }

  async function openSubmissionsModal(assessment: AssessmentItem) {
    setSelectedAssessmentForSubs(assessment);
    setSubmissionsOpen(true);
    setLoadingSubmissions(true);
    try {
      const data = await getAssessmentSubmissions({
        assessmentId: assessment.id,
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
      const res = await deleteAssessmentSubmission(deleteSubTargetId);
      if (res.success) {
        toast.success("Student submission deleted (attempt reset)");
        if (selectedAssessmentForSubs) {
          const data = await getAssessmentSubmissions({
            assessmentId: selectedAssessmentForSubs.id,
          });
          setSubmissionsList(data);
        }
        if (selectedCategory) {
          loadAssessmentsList(
            selectedCategory,
            selectedCategory === "lab_assessment" ? selectedLab?.id : undefined,
          );
        }
      } else {
        toast.error(res.error || "Failed to delete submission");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete submission");
    } finally {
      setDeleteSubTargetId(null);
    }
  }

  const filteredAssessments = assessments.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.lab && item.lab.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredLabs = availableLabs.filter(
    (lab) =>
      lab.name.toLowerCase().includes(labSearchQuery.toLowerCase()) ||
      (lab.code && lab.code.toLowerCase().includes(labSearchQuery.toLowerCase())) ||
      (lab.description &&
        lab.description.toLowerCase().includes(labSearchQuery.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-6xl mx-auto w-full px-1 sm:px-0">
      
      {/* ─── 1. TOP MAIN CATEGORY SWITCHER TABS ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-muted/60 p-1.5 rounded-xl border w-full sm:w-fit">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("lab_assessment");
              setSelectedLab(null);
            }}
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-all ${
              selectedCategory === "lab_assessment"
                ? "bg-card text-foreground shadow-xs border font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span className="truncate">Lab Assessments</span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[11px] px-1.5 py-0 font-mono">
              {availableLabs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory("coding_assessment");
              setSelectedLab(null);
            }}
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-all ${
              selectedCategory === "coding_assessment"
                ? "bg-card text-foreground shadow-xs border font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Coding Assessments</span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[11px] px-1.5 py-0 font-mono">
              {loadingSummary ? "-" : summary?.codingAssessments.total ?? 0}
            </Badge>
          </button>
        </div>

        {/* Global summary stats / Refresh */}
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadLookups();
              loadSummary();
              if (selectedCategory === "coding_assessment") {
                loadAssessmentsList("coding_assessment");
              } else if (selectedLab) {
                loadAssessmentsList("lab_assessment", selectedLab.id);
              }
            }}
            className="gap-1.5 h-8 text-xs w-full sm:w-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── 2. LAB ASSESSMENTS: FOLDERS VIEW (WHEN NO LAB SELECTED) ───────────── */}
      {selectedCategory === "lab_assessment" && !selectedLab && (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Header & New Lab Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-medium tracking-tight text-foreground flex items-center gap-2">
                <Folder className="h-5 w-5 text-muted-foreground" />
                Lab Subject Folders
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click on a lab subject below to view, schedule, and create internal lab assessments.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {availableLabs.length > 3 && (
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search labs..."
                    value={labSearchQuery}
                    onChange={(e) => setLabSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs w-full"
                  />
                </div>
              )}

              {isAdmin && (
                <Button
                  onClick={() => setCreateLabOpen(true)}
                  className="gap-1.5 h-9 text-xs sm:text-sm w-full sm:w-auto shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Create Lab Subject
                </Button>
              )}
            </div>
          </div>

          {/* Grid of Google Classroom style folder cards */}
          {filteredLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center rounded-2xl border border-dashed bg-muted/20">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Folder className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base text-foreground">
                No lab subject folders found
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                {labSearchQuery
                  ? "No lab subjects match your search."
                  : "Create a lab subject folder to start organizing internal lab exams."}
              </p>
              {isAdmin && (
                <Button
                  onClick={() => setCreateLabOpen(true)}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Create Lab Subject
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredLabs.map((lab) => (
                <Card
                  key={lab.id}
                  className="group cursor-pointer border hover:border-foreground/40 hover:shadow-xs transition-all duration-200 bg-card rounded-2xl flex flex-col justify-between overflow-hidden"
                  onClick={() => {
                    setSelectedLab(lab);
                    loadAssessmentsList("lab_assessment", lab.id);
                  }}
                >
                  {/* Card Header Band */}
                  <div className="p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-muted group-hover:bg-foreground/5 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                        <Folder className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {lab.code && (
                          <Badge variant="outline" className="font-mono text-[11px] sm:text-xs">
                            {lab.code}
                          </Badge>
                        )}
                        {lab.semester && (
                          <Badge variant="secondary" className="text-[11px] sm:text-xs">
                            Sem {lab.semester}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-sm sm:text-base text-foreground group-hover:text-foreground line-clamp-2 leading-snug">
                        {lab.name}
                      </h3>
                      {lab.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                          {lab.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Strip */}
                  <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-muted/30 border-t flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-medium text-foreground">
                        {lab.assessmentsCount ?? 0} Assessment
                        {(lab.assessmentsCount ?? 0) === 1 ? "" : "s"}
                      </span>
                      {lab.activeAssessmentsCount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ({lab.activeAssessmentsCount} active)
                        </span>
                      )}
                    </div>

                    <span className="font-medium text-foreground group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Open Lab &rarr;
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 3. INSIDE A LAB FOLDER: ASSESSMENTS LIST VIEW ──────────────────────── */}
      {selectedCategory === "lab_assessment" && selectedLab && (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Top Banner with prominent "Back to All Labs" button */}
          <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border bg-card shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLab(null)}
                  className="gap-2 font-normal w-fit text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to All Labs
                </Button>
                <div className="h-5 w-px bg-border hidden sm:block" />
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-medium text-foreground">
                    {selectedLab.name}
                  </h2>
                  {selectedLab.code && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedLab.code}
                    </Badge>
                  )}
                  {selectedLab.semester && (
                    <Badge variant="secondary" className="text-xs">
                      Semester {selectedLab.semester}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action: Create Assessment for this Lab */}
              <Button
                onClick={() => {
                  setEditingAssessment(null);
                  setFormOpen(true);
                }}
                className="gap-1.5 shrink-0 font-normal text-xs sm:text-sm w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Create Lab Assessment
              </Button>
            </div>

            {selectedLab.description && (
              <p className="text-xs text-muted-foreground border-t pt-2 mt-1">
                {selectedLab.description}
              </p>
            )}
          </div>

          {/* Search bar inside this lab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search assessments in ${selectedLab.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs w-full"
              />
            </div>
            <span className="text-xs text-muted-foreground font-normal self-end sm:self-auto">
              {filteredAssessments.length} assessment
              {filteredAssessments.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Assessments List inside this lab */}
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-muted-foreground gap-2 border rounded-2xl bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              <p className="text-xs">Loading assessments...</p>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center rounded-2xl border border-dashed bg-card">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <ClipboardCheckIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base text-foreground">
                No assessments in this lab folder
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {searchQuery
                  ? "No assessments match your search query."
                  : `Create your first lab assessment for ${selectedLab.name} to assign sections and faculty.`}
              </p>
              <Button
                onClick={() => {
                  setEditingAssessment(null);
                  setFormOpen(true);
                }}
                className="gap-1.5 font-normal text-xs sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                Create Lab Assessment
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
              {filteredAssessments.map((assessment) => (
                <Card
                  key={assessment.id}
                  className="border hover:border-foreground/30 hover:shadow-xs transition-all bg-card rounded-xl overflow-hidden p-3.5 sm:p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    {/* Left: Info */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {getStatusBadge(assessment.status)}
                        {assessment.requiresPin && (
                          <Badge variant="outline" className="gap-1 text-[11px] py-0">
                            <Key className="h-3 w-3 text-amber-500" />
                            PIN Required
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {assessment.durationMinutes} mins
                        </span>
                      </div>

                      <h3 className="font-medium text-sm sm:text-base text-foreground truncate">
                        {assessment.title}
                      </h3>

                      {assessment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {assessment.description}
                        </p>
                      )}

                      {/* Section & Faculty Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Users className="h-3 w-3" />
                          Sections:
                        </span>
                        {assessment.groups.length > 0 ? (
                          assessment.groups.map((g) => (
                            <span
                              key={g.groupId}
                              className="px-2 py-0.5 rounded bg-muted text-[11px] text-foreground"
                            >
                              {g.group.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            No sections assigned
                          </span>
                        )}

                        <span className="text-border mx-1">·</span>

                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <UserCheck className="h-3 w-3" />
                          {assessment.assignedFacultyCount} Faculty Assigned
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 justify-between sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSubmissionsModal(assessment)}
                        className="gap-1.5 text-xs h-8 sm:h-9 font-normal flex-1 sm:flex-none justify-center text-muted-foreground hover:text-foreground"
                      >
                        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                        Submissions ({assessment.submissionsCount})
                      </Button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingAssessment(assessment);
                            setFormOpen(true);
                          }}
                          title="Edit Assessment"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteTargetId(assessment.id)}
                          title="Delete Assessment"
                          className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 4. CODING ASSESSMENTS VIEW ────────────────────────────────────────── */}
      {selectedCategory === "coding_assessment" && (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Header & Create Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-medium tracking-tight text-foreground flex items-center gap-2">
                <Code2 className="h-5 w-5 text-muted-foreground" />
                Coding Assessments
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage problem collection assessments, practice contests, and assign faculty.
              </p>
            </div>

            <Button
              onClick={() => {
                setEditingAssessment(null);
                setFormOpen(true);
              }}
              className="gap-1.5 h-9 font-normal text-xs sm:text-sm w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Create Coding Assessment
            </Button>
          </div>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search coding assessments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs w-full"
              />
            </div>
            <span className="text-xs text-muted-foreground font-normal self-end sm:self-auto">
              {filteredAssessments.length} assessment
              {filteredAssessments.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* List of Coding Assessments */}
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-muted-foreground gap-2 border rounded-2xl bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              <p className="text-xs">Loading coding assessments...</p>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center rounded-2xl border border-dashed bg-card">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <ClipboardCheckIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base text-foreground">
                No coding assessments found
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                {searchQuery
                  ? "No assessments match your search query."
                  : "Create your first coding assessment to configure problem collections."}
              </p>
              <Button
                onClick={() => {
                  setEditingAssessment(null);
                  setFormOpen(true);
                }}
                className="gap-1.5 font-normal text-xs sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                Create Coding Assessment
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
              {filteredAssessments.map((assessment) => (
                <Card
                  key={assessment.id}
                  className="border hover:border-foreground/30 hover:shadow-xs transition-all bg-card rounded-xl overflow-hidden p-3.5 sm:p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    {/* Left: Info */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {getStatusBadge(assessment.status)}
                        {assessment.requiresPin && (
                          <Badge variant="outline" className="gap-1 text-[11px] py-0">
                            <Key className="h-3 w-3 text-amber-500" />
                            PIN Required
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {assessment.durationMinutes} mins
                        </span>
                      </div>

                      <h3 className="font-medium text-sm sm:text-base text-foreground truncate">
                        {assessment.title}
                      </h3>

                      {assessment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {assessment.description}
                        </p>
                      )}

                      {/* Section & Faculty Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Users className="h-3 w-3" />
                          Sections:
                        </span>
                        {assessment.groups.length > 0 ? (
                          assessment.groups.map((g) => (
                            <span
                              key={g.groupId}
                              className="px-2 py-0.5 rounded bg-muted text-[11px] text-foreground"
                            >
                              {g.group.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            No sections assigned
                          </span>
                        )}

                        <span className="text-border mx-1">·</span>

                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <UserCheck className="h-3 w-3" />
                          {assessment.assignedFacultyCount} Faculty Assigned
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 justify-between sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSubmissionsModal(assessment)}
                        className="gap-1.5 text-xs h-8 sm:h-9 font-normal flex-1 sm:flex-none justify-center text-muted-foreground hover:text-foreground"
                      >
                        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                        Submissions ({assessment.submissionsCount})
                      </Button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingAssessment(assessment);
                            setFormOpen(true);
                          }}
                          title="Edit Assessment"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteTargetId(assessment.id)}
                          title="Delete Assessment"
                          className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 4. CREATE / EDIT ASSESSMENT DIALOG ──────────────────────────────────── */}
      <AssessmentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editingAssessment}
        fixedLabId={selectedLab?.id || null}
        categoryType={
          editingAssessment
            ? (editingAssessment.assessmentType as AssessmentCategory)
            : (selectedCategory || "lab_assessment")
        }
        availableLabs={availableLabs}
        availableCollections={availableCollections}
        availableGroups={availableGroups}
        availableFaculty={availableFaculty}
        onSaved={() => {
          setFormOpen(false);
          if (selectedCategory) {
            loadAssessmentsList(
              selectedCategory,
              selectedCategory === "lab_assessment"
                ? selectedLab?.id
                : undefined,
            );
          }
          loadSummary();
          loadLookups();
        }}
      />

      {/* ─── 5. CREATE LAB SUBJECT DIALOG ────────────────────────────────────────── */}
      <CreateLabDialog
        open={createLabOpen}
        onClose={() => setCreateLabOpen(false)}
        onCreated={(newLab) => {
          loadLookups();
          loadSummary();
          setSelectedLab(newLab);
          loadAssessmentsList("lab_assessment", newLab.id);
        }}
      />

      {/* ─── 6. SUBMISSIONS MODAL ────────────────────────────────────────────────── */}
      <Dialog
        open={submissionsOpen}
        onOpenChange={(open) => {
          setSubmissionsOpen(open);
          if (!open) setSubmissionsSearchQuery("");
        }}
      >
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
          {submissionsList.length > 0 && (
            <div className="relative pt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by student name, roll number, email, or section..."
                value={submissionsSearchQuery}
                onChange={(e) => setSubmissionsSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/20"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs sm:text-sm">Loading submissions...</span>
              </div>
            ) : submissionsList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs sm:text-sm">
                No student submissions found for this assessment yet.
              </div>
            ) : (
              <div className="divide-y border rounded-lg overflow-hidden">
                {submissionsList
                  .filter((sub) => {
                    if (!submissionsSearchQuery.trim()) return true;
                    const query = submissionsSearchQuery.toLowerCase();
                    const name = (sub.user?.name || "").toLowerCase();
                    const username = (sub.user?.username || "").toLowerCase();
                    const email = (sub.user?.email || "").toLowerCase();
                    const section = (sub.user?.section || "").toLowerCase();
                    return (
                      name.includes(query) ||
                      username.includes(query) ||
                      email.includes(query) ||
                      section.includes(query)
                    );
                  })
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
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
                              {sub.status.replace("_", " ")}
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
            <Button variant="outline" onClick={() => setSubmissionsOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 7. CONFIRM DELETE ASSESSMENT ────────────────────────────────────────── */}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Assessment</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this assessment? This will delete
              all section assignments and student submissions associated with
              it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssessment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto text-xs sm:text-sm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 8. CONFIRM DELETE INDIVIDUAL SUBMISSION ─────────────────────────────── */}
      <AlertDialog
        open={Boolean(deleteSubTargetId)}
        onOpenChange={(open) => !open && setDeleteSubTargetId(null)}
      >
        <AlertDialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          {(() => {
            const targetSub = submissionsList.find((s) => s.id === deleteSubTargetId);
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base sm:text-lg">
                    Delete Submission for {targetSub?.user?.name || "Student"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs sm:text-sm space-y-1.5">
                    <div>
                      Are you sure you want to delete this submission for{" "}
                      <span className="font-medium text-foreground">
                        {targetSub?.user?.name || "the student"}
                      </span>{" "}
                      ({targetSub?.user?.username || targetSub?.user?.email})?
                    </div>
                    <div className="text-muted-foreground">
                      This will permanently clear their submitted code, test case results, and score (
                      {targetSub?.score ?? 0} marks), allowing them to re-attempt the assessment.
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                  <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSubmission}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto text-xs sm:text-sm gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete & Reset Attempt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClipboardCheckIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

// ─── CREATE LAB SUBJECT DIALOG ───────────────────────────────────────────────

function CreateLabDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (newLab: any) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a Lab Subject name");
      return;
    }
    try {
      setSubmitting(true);
      const res = await createLab({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        semester: semester ? Number(semester) : undefined,
      });
      if (res.success && res.lab) {
        toast.success("Lab subject created successfully");
        onCreated(res.lab);
        setName("");
        setCode("");
        setDescription("");
        setSemester("");
        onClose();
      } else {
        toast.error(res.error || "Failed to create lab subject");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create lab subject");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Create Lab Subject Folder</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add a new lab subject folder to organize and group related lab assessments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lab-name" className="text-xs sm:text-sm">Lab Subject Name *</Label>
            <Input
              id="lab-name"
              placeholder="e.g. Database Management Systems Laboratory"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs sm:text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lab-code" className="text-xs sm:text-sm">Subject Code</Label>
              <Input
                id="lab-code"
                placeholder="e.g. CS3301"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lab-sem" className="text-xs sm:text-sm">Semester</Label>
              <Input
                id="lab-sem"
                type="number"
                min={1}
                max={8}
                placeholder="e.g. 3"
                value={semester}
                onChange={(e) =>
                  setSemester(e.target.value ? Number(e.target.value) : "")
                }
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lab-desc" className="text-xs sm:text-sm">Description</Label>
            <Textarea
              id="lab-desc"
              placeholder="Optional syllabus, course overview, or department notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs sm:text-sm"
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5 w-full sm:w-auto text-xs sm:text-sm">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Lab Subject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ASSESSMENT FORM DIALOG (CREATE / EDIT) ──────────────────────────────────

function AssessmentFormDialog({
  open,
  onClose,
  initial,
  categoryType,
  fixedLabId,
  availableLabs,
  availableCollections,
  availableGroups,
  availableFaculty,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: AssessmentItem | null;
  categoryType: AssessmentCategory;
  fixedLabId?: string | null;
  availableLabs: any[];
  availableCollections: any[];
  availableGroups: any[];
  availableFaculty: any[];
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const category = initial
    ? (initial.assessmentType as AssessmentCategory)
    : categoryType;
  const isLab = category === "lab_assessment";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [questionCount, setQuestionCount] = useState(isLab ? 2 : 3);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");

  const [groupAssignments, setGroupAssignments] = useState<
    { groupId: string; facultyIds: string[] }[]
  >([]);

  const selectedLabObj = availableLabs.find((l) => l.id === selectedLabId);

  const filteredCollections = availableCollections.filter((c) =>
    c.title.toLowerCase().includes(collectionSearch.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(collectionSearch.toLowerCase())),
  );

  useEffect(() => {
    if (initial) {
      setTitle(initial.title || "");
      setDescription(initial.description || "");
      setSelectedLabId(initial.labId || "");
      setSelectedCollectionIds(
        (initial as any).collections?.map((c: any) => c.collectionId) || [],
      );
      setDurationMinutes(initial.durationMinutes || 60);
      setTotalMarks(
        Number((initial as any).gradingConfig?.totalMarks) || 100,
      );
      setQuestionCount(
        Number((initial as any).strategyConfig?.count) || (isLab ? 2 : 3),
      );
      setStartTimeInput(toDatetimeLocalString(initial.startTime));
      setEndTimeInput(toDatetimeLocalString(initial.endTime));

      const savedExIds = (initial as any).strategyConfig?.exerciseIds;
      if (Array.isArray(savedExIds)) {
        setSelectedExerciseIds(savedExIds);
      } else {
        const lab = availableLabs.find((l) => l.id === initial.labId);
        setSelectedExerciseIds(lab?.exercises?.map((e: any) => e.id) || []);
      }

      const map: Record<string, string[]> = {};
      for (const g of (initial as any).groups || []) {
        map[g.groupId] = [];
      }
      for (const gf of (initial as any).groupFaculty || []) {
        if (!map[gf.groupId]) map[gf.groupId] = [];
        map[gf.groupId].push(gf.facultyId);
      }

      setGroupAssignments(
        Object.entries(map).map(([groupId, facultyIds]) => ({
          groupId,
          facultyIds,
        })),
      );
    } else {
      setTitle("");
      setDescription("");
      setSelectedCollectionIds([]);
      setDurationMinutes(60);
      setTotalMarks(100);
      setQuestionCount(isLab ? 2 : 3);
      const now = new Date();
      const defaultEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      setStartTimeInput(toDatetimeLocalString(now));
      setEndTimeInput(toDatetimeLocalString(defaultEnd));

      if (categoryType === "lab_assessment") {
        const targetId = fixedLabId || availableLabs[0]?.id || "";
        setSelectedLabId(targetId);

        if (targetId) {
          const lab = availableLabs.find((l) => l.id === targetId);
          setSelectedExerciseIds(lab?.exercises?.map((e: any) => e.id) || []);

          if (lab?.facultyAssignments && lab.facultyAssignments.length > 0) {
            const map: Record<string, string[]> = {};
            for (const fa of lab.facultyAssignments) {
              if (!map[fa.groupId]) map[fa.groupId] = [];
              if (!map[fa.groupId].includes(fa.facultyId)) {
                map[fa.groupId].push(fa.facultyId);
              }
            }
            setGroupAssignments(
              Object.entries(map).map(([groupId, facultyIds]) => ({
                groupId,
                facultyIds,
              })),
            );
          } else {
            setGroupAssignments([]);
          }
        } else {
          setSelectedExerciseIds([]);
          setGroupAssignments([]);
        }
      } else {
        setSelectedLabId("");
        setSelectedExerciseIds([]);
        setGroupAssignments([]);
      }
    }
  }, [initial, open, categoryType, fixedLabId, availableLabs]);

  function handleLabSelect(labId: string) {
    setSelectedLabId(labId);
    const targetLab = availableLabs.find((l) => l.id === labId);
    if (targetLab) {
      setSelectedExerciseIds(targetLab.exercises?.map((e: any) => e.id) || []);
    }

    if (targetLab?.facultyAssignments && targetLab.facultyAssignments.length > 0) {
      const map: Record<string, string[]> = {};
      for (const fa of targetLab.facultyAssignments) {
        if (!map[fa.groupId]) map[fa.groupId] = [];
        if (!map[fa.groupId].includes(fa.facultyId)) {
          map[fa.groupId].push(fa.facultyId);
        }
      }
      const populated = Object.entries(map).map(([groupId, facultyIds]) => ({
        groupId,
        facultyIds,
      }));
      setGroupAssignments(populated);
      toast.info(
        `Auto-loaded ${populated.length} section assignment(s) from ${targetLab.name}`,
      );
    } else {
      setGroupAssignments([]);
    }
  }

  function toggleGroup(groupId: string) {
    setGroupAssignments((prev) => {
      const exists = prev.find((item) => item.groupId === groupId);
      if (exists) {
        return prev.filter((item) => item.groupId !== groupId);
      } else {
        return [...prev, { groupId, facultyIds: [] }];
      }
    });
  }

  function setFacultyForGroup(groupId: string, facultyId: string) {
    setGroupAssignments((prev) =>
      prev.map((item) => {
        if (item.groupId === groupId) {
          const has = item.facultyIds.includes(facultyId);
          return {
            ...item,
            facultyIds: has
              ? item.facultyIds.filter((f) => f !== facultyId)
              : [...item.facultyIds, facultyId],
          };
        }
        return item;
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an assessment title");
      return;
    }

    if (isLab && !selectedLabId) {
      toast.error("Please select a target Lab for this assessment");
      return;
    }

    if (!startTimeInput) {
      toast.error("Please set a Start Date & Time for this assessment");
      return;
    }

    if (!endTimeInput) {
      toast.error("Please set an End Date & Time for this assessment");
      return;
    }

    const startDate = new Date(startTimeInput);
    const endDate = new Date(endTimeInput);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast.error("Please provide valid Start and End dates");
      return;
    }

    if (endDate <= startDate) {
      toast.error("End Date & Time must be after Start Date & Time");
      return;
    }

    if (groupAssignments.length === 0) {
      toast.error("Please assign at least one section/group to this assessment");
      return;
    }

    try {
      setSubmitting(true);

      // Collect collection IDs for lab exercises if isLab
      let labCollectionIds: string[] = [];
      if (isLab && selectedLabObj?.exercises) {
        const activeExercises = selectedLabObj.exercises.filter((ex: any) =>
          selectedExerciseIds.includes(ex.id),
        );
        labCollectionIds = activeExercises
          .map((ex: any) => ex.collectionId)
          .filter(Boolean);
      }

      const payload: UpsertAssessmentInput = {
        id: initial?.id,
        title: title.trim(),
        description: description.trim() || null,
        assessmentType: category,
        labId: isLab ? selectedLabId : null,
        durationMinutes: Number(durationMinutes) || 60,
        totalMarks: Number(totalMarks) || 100,
        startTime: startTimeInput ? new Date(startTimeInput) : null,
        endTime: endTimeInput ? new Date(endTimeInput) : null,
        requiresPin: false,
        strategyType: "random_n",
        strategyConfig: {
          count: Number(questionCount) || (isLab ? 2 : 3),
          collectionIds: isLab ? labCollectionIds : selectedCollectionIds,
        },
        gradingStrategy: "linear",
        gradingConfig: {
          totalMarks: Number(totalMarks) || 100,
        },
        groupAssignments,
      };

      const res = await upsertAssessment(payload);
      if (res.success) {
        toast.success(
          initial
            ? `${isLab ? "Lab" : "Coding"} Assessment updated successfully`
            : `${isLab ? "Lab" : "Coding"} Assessment created successfully`,
        );
        onSaved();
      } else {
        toast.error(res.error || "Failed to save assessment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save assessment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-medium">
              {initial
                ? isLab
                  ? "Edit Lab Assessment"
                  : "Edit Coding Assessment"
                : isLab
                  ? "Create Lab Assessment"
                  : "Create Coding Assessment"}
            </DialogTitle>
            <Badge
              variant="outline"
              className="gap-1.5 py-1 px-2.5 font-normal text-xs w-fit"
            >
              {isLab ? (
                <>
                  <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                  Lab Assessment
                </>
              ) : (
                <>
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Coding Assessment
                </>
              )}
            </Badge>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {isLab
              ? "Configure lab assessment parameters, exercises, total marks, and assign faculty."
              : "Configure coding assessment parameters, problem collections, total marks, and assign faculty."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 sm:space-y-5 py-2 pr-1"
        >
          {/* Title & Description */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs sm:text-sm">Title *</Label>
              <Input
                id="title"
                placeholder={
                  isLab
                    ? "e.g. Data Structures Lab Internal 1"
                    : "e.g. Midterm Coding Assessment"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs sm:text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs sm:text-sm">Description</Label>
              <Textarea
                id="desc"
                placeholder="Optional instructions or syllabus notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Category-Specific Target & Problem Collections Selection */}
          {isLab && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs sm:text-sm">Target Lab Subject *</Label>
              {fixedLabId && selectedLabObj ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedLabObj.name}
                    </span>
                  </div>
                  {selectedLabObj.code && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedLabObj.code}
                    </Badge>
                  )}
                </div>
              ) : (
                <Select value={selectedLabId} onValueChange={handleLabSelect}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Select a Lab..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLabs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id} className="text-xs sm:text-sm">
                        {lab.name} {lab.code ? `(${lab.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Problem Collections Dropdown & Question Count */}
          <div className="space-y-3 border-t pt-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs sm:text-sm font-medium">
                  Select Collections *
                </Label>
                {selectedCollectionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionIds([])}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-xs sm:text-sm h-9 font-normal bg-background px-3"
                  >
                    <span className="truncate">
                      {selectedCollectionIds.length === 0
                        ? "Choose problem collections..."
                        : selectedCollectionIds.length === 1
                          ? availableCollections.find(
                              (c) => c.id === selectedCollectionIds[0],
                            )?.title || "1 collection selected"
                          : `${selectedCollectionIds.length} collections selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px] max-h-64 overflow-hidden p-0 flex flex-col"
                  align="start"
                >
                  <div
                    className="p-2 border-b bg-muted/20 flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search collections..."
                        value={collectionSearch}
                        onChange={(e) => setCollectionSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8 pl-8 pr-7 text-xs bg-background"
                      />
                      {collectionSearch && (
                        <button
                          type="button"
                          onClick={() => setCollectionSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5 overflow-y-auto max-h-48 space-y-0.5">
                    {filteredCollections.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        {collectionSearch
                          ? "No matching collections"
                          : "No problem collections available"}
                      </div>
                    ) : (
                      filteredCollections.map((col) => {
                        const isSelected = selectedCollectionIds.includes(col.id);
                        return (
                          <div
                            key={col.id}
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedCollectionIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== col.id)
                                  : [...prev, col.id],
                              );
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer hover:bg-muted/70 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="rounded border-border text-primary"
                            />
                            <span className="truncate flex-1">{col.title}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected Collections Badges */}
              {selectedCollectionIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                  {selectedCollectionIds.map((id) => {
                    const col = availableCollections.find((c) => c.id === id);
                    if (!col) return null;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5"
                      >
                        <span className="truncate max-w-[180px]">{col.title}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCollectionIds((prev) =>
                              prev.filter((i) => i !== id),
                            )
                          }
                          className="hover:text-destructive text-muted-foreground ml-0.5 cursor-pointer text-xs"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="question-count" className="text-xs sm:text-sm">
                Number of Questions Given Per Student
              </Label>
              <Input
                id="question-count"
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Duration & Total Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="duration" className="text-xs sm:text-sm">
                Duration (Minutes)
              </Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={360}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="total-marks" className="text-xs sm:text-sm">
                Total Marks
              </Label>
              <Input
                id="total-marks"
                type="number"
                min={1}
                max={1000}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Assessment Schedule Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-xs sm:text-sm font-medium">
                Start Date & Time *
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="text-xs sm:text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-time" className="text-xs sm:text-sm font-medium">
                End Date & Time *
              </Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTimeInput}
                onChange={(e) => setEndTimeInput(e.target.value)}
                className="text-xs sm:text-sm"
                required
              />
            </div>
          </div>

          {/* Section & Faculty Assignment Matrix */}
          <div className="space-y-2.5 pt-3 border-t">
            <div>
              <Label className="text-xs sm:text-sm font-medium">
                Section & Faculty Assignments *
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Select student sections and assign faculty members to manage
                scheduling and submissions.
              </p>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {availableGroups.map((group) => {
                const assignment = groupAssignments.find(
                  (a) => a.groupId === group.id,
                );
                const isSelected = Boolean(assignment);

                return (
                  <div
                    key={group.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-xs sm:text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleGroup(group.id)}
                          className="rounded border-border text-primary"
                        />
                        <span>{group.name}</span>
                      </label>
                    </div>

                    {/* Faculty checkboxes when section selected */}
                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-border/60 pl-2 sm:pl-6 space-y-1.5">
                        <div className="text-[11px] font-medium text-muted-foreground">
                          Assign Faculty to {group.name}:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                          {availableFaculty.map((f) => {
                            const isAssigned =
                              assignment?.facultyIds.includes(f.id) || false;
                            return (
                              <label
                                key={f.id}
                                className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() =>
                                    setFacultyForGroup(group.id, f.id)
                                  }
                                  className="rounded border-border text-primary"
                                />
                                <span className="truncate">{f.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 w-full sm:w-auto text-xs sm:text-sm"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial
                ? "Save Changes"
                : isLab
                  ? "Create Lab Assessment"
                  : "Create Coding Assessment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
