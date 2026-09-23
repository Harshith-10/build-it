"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Clock,
  Code2,
  FlaskConical,
  Folder,
  Key,
  LayoutList,
  Timer,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalDateTimeText } from "@/components/ui/local-date-time-text";
import { ExamCardAction } from "@/app/(student)/exams/exam-card-action";

export interface StudentAssessmentItem {
  id: string;
  title: string;
  description: string | null;
  assessmentType: "lab_assessment" | "coding_assessment";
  lab: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  durationMinutes: number;
  totalMarks: number;
  questionCount?: number | null;
  requiresPin: boolean;
  startTime: Date;
  endTime: Date;
  status: "upcoming" | "active" | "ended";
  slotGroupName: string;
  attemptStatus: string;
  score: number | null;
}

interface StudentAssessmentsManagerProps {
  assessments: StudentAssessmentItem[];
  serverNowMs: number;
}

export function StudentAssessmentsManager({
  assessments,
  serverNowMs,
}: StudentAssessmentsManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    "lab_assessment" | "coding_assessment"
  >("lab_assessment");
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500 hover:bg-green-600 text-white";
      case "upcoming":
        return "bg-blue-500 hover:bg-blue-600 text-white";
      case "ended":
        return "bg-neutral-500 hover:bg-neutral-600 text-white";
      default:
        return "bg-neutral-500 hover:bg-neutral-600 text-white";
    }
  };

  const labAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "lab_assessment"),
    [assessments],
  );

  const codingAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "coding_assessment"),
    [assessments],
  );

  // Group lab assessments into subject folders
  const labFolders = useMemo(() => {
    const labMap = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string | null;
        description?: string | null;
        assessments: StudentAssessmentItem[];
        activeCount: number;
      }
    >();

    labAssessments.forEach((item) => {
      const labId = item.lab?.id || "general";
      const labName = item.lab?.name || "General Lab Assessments";
      const labCode = item.lab?.code || null;
      const labDesc = item.description || null;

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
      if (item.status === "active") entry.activeCount++;
    });

    return Array.from(labMap.values());
  }, [labAssessments]);

  const selectedLab = useMemo(() => {
    if (!selectedLabId) return null;
    return labFolders.find((f) => f.id === selectedLabId) || null;
  }, [selectedLabId, labFolders]);

  const displayedLabAssessments = useMemo(() => {
    return selectedLabId
      ? labAssessments.filter(
          (a) => (a.lab?.id || "general") === selectedLabId,
        )
      : [];
  }, [selectedLabId, labAssessments]);

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
                You do not have any lab assessments assigned to your section at this time.
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

      {/* ─── 3. INSIDE LAB ASSESSMENTS (CARDS GRID) ────────────────────────── */}
      {selectedCategory === "lab_assessment" && selectedLabId && (
        <div className="flex flex-col gap-3">
          {/* Breadcrumb Header */}
          {selectedLab && (
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
              {displayedLabAssessments.length} assessment{displayedLabAssessments.length !== 1 ? "s" : ""}
            </p>
          </div>

          {displayedLabAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <FlaskConical className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No assessments found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No assessments scheduled in this section.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayedLabAssessments.map((assessment) => (
                <Card key={assessment.id} className="flex flex-col">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(assessment.status)}>
                          {assessment.status.charAt(0).toUpperCase() +
                            assessment.status.slice(1)}
                        </Badge>
                        {assessment.requiresPin && (
                          <Badge variant="outline" className="text-[10px] py-0 font-normal gap-1">
                            <Key className="h-2.5 w-2.5 text-amber-500" />
                            PIN
                          </Badge>
                        )}
                      </div>
                      {assessment.status === "active" && (
                        <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      )}
                    </div>
                    <CardTitle className="line-clamp-1">{assessment.title}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[40px]">
                      {assessment.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      <div className="col-span-2 flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4" />
                        <div className="leading-tight">
                          <span className="font-bold">Starts At:</span>{" "}
                          <LocalDateTimeText
                            value={assessment.startTime}
                            options={{
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZoneName: "short",
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4" />
                        <div className="leading-tight">
                          <span className="font-bold">Ends At:</span>{" "}
                          <LocalDateTimeText
                            value={assessment.endTime}
                            options={{
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZoneName: "short",
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        <span>{assessment.durationMinutes} mins</span>
                      </div>
                      {assessment.totalMarks ? (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <span>{assessment.totalMarks} Total Marks</span>
                        </div>
                      ) : null}
                      {assessment.questionCount ? (
                        <div className="flex items-center gap-2">
                          <LayoutList className="h-4 w-4" />
                          <span>{assessment.questionCount} Questions</span>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <ExamCardAction
                      examId={assessment.id}
                      status={assessment.status}
                      effectiveStart={assessment.startTime}
                      isSubmitted={assessment.attemptStatus === "completed"}
                      isInProgress={assessment.attemptStatus === "in_progress"}
                      serverNowMs={serverNowMs}
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 4. CODING ASSESSMENTS (CARDS GRID MATCHING EXAMS) ──────────── */}
      {selectedCategory === "coding_assessment" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {codingAssessments.length} assessment{codingAssessments.length !== 1 ? "s" : ""}
            </p>
          </div>

          {codingAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <Code2 className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No coding assessments found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No coding assessments scheduled in your section.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {codingAssessments.map((assessment) => (
                <Card key={assessment.id} className="flex flex-col">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(assessment.status)}>
                          {assessment.status.charAt(0).toUpperCase() +
                            assessment.status.slice(1)}
                        </Badge>
                        {assessment.requiresPin && (
                          <Badge variant="outline" className="text-[10px] py-0 font-normal gap-1">
                            <Key className="h-2.5 w-2.5 text-amber-500" />
                            PIN
                          </Badge>
                        )}
                      </div>
                      {assessment.status === "active" && (
                        <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      )}
                    </div>
                    <CardTitle className="line-clamp-1">{assessment.title}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[40px]">
                      {assessment.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      <div className="col-span-2 flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4" />
                        <div className="leading-tight">
                          <span className="font-bold">Starts At:</span>{" "}
                          <LocalDateTimeText
                            value={assessment.startTime}
                            options={{
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZoneName: "short",
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4" />
                        <div className="leading-tight">
                          <span className="font-bold">Ends At:</span>{" "}
                          <LocalDateTimeText
                            value={assessment.endTime}
                            options={{
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZoneName: "short",
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        <span>{assessment.durationMinutes} mins</span>
                      </div>
                      {assessment.totalMarks ? (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <span>{assessment.totalMarks} Total Marks</span>
                        </div>
                      ) : null}
                      {assessment.questionCount ? (
                        <div className="flex items-center gap-2">
                          <LayoutList className="h-4 w-4" />
                          <span>{assessment.questionCount} Questions</span>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <ExamCardAction
                      examId={assessment.id}
                      status={assessment.status}
                      effectiveStart={assessment.startTime}
                      isSubmitted={assessment.attemptStatus === "completed"}
                      isInProgress={assessment.attemptStatus === "in_progress"}
                      serverNowMs={serverNowMs}
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
