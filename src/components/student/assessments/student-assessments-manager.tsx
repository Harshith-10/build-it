"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock,
  Code2,
  FlaskConical,
  Folder,
  Key,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

  const displayedAssessments = useMemo(() => {
    if (selectedCategory === "lab_assessment") {
      return selectedLabId
        ? labAssessments.filter(
            (a) => (a.lab?.id || "general") === selectedLabId,
          )
        : [];
    }
    return codingAssessments;
  }, [selectedCategory, selectedLabId, labAssessments, codingAssessments]);

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
              <FlaskConical className="h-8 w-8 text-muted-foreground/60 mb-2" />
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
                const isActive = assessment.status === "active";
                const isUpcoming = assessment.status === "upcoming";
                const isSubmitted = assessment.attemptStatus === "completed";

                return (
                  <div
                    key={assessment.id}
                    className="border rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/50 transition-colors bg-card min-w-0"
                  >
                    {/* Number Box & Content */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-semibold shrink-0 text-foreground">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-foreground break-words">
                            {assessment.title}
                          </p>
                          {assessment.requiresPin && (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal gap-1">
                              <Key className="h-2.5 w-2.5 text-amber-500" />
                              PIN
                            </Badge>
                          )}
                        </div>

                        {/* Window & Score */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            <LocalDateTimeText
                              value={assessment.startTime}
                              options={{
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              }}
                            />
                            {" → "}
                            <LocalDateTimeText
                              value={assessment.endTime}
                              options={{
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              }}
                            />
                            {isActive && (
                              <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            )}
                          </span>

                          {isSubmitted && (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Score: {assessment.score ?? 0} / {assessment.totalMarks || 100}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Badge & Action Button */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center w-full sm:w-auto">
                      {isActive ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-normal shrink-0"
                        >
                          Active
                        </Badge>
                      ) : isUpcoming ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-normal shrink-0"
                        >
                          Upcoming
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground font-normal shrink-0"
                        >
                          Ended
                        </Badge>
                      )}

                      <div className="min-w-[140px] flex-1 sm:flex-initial">
                        <ExamCardAction
                          examId={assessment.id}
                          status={assessment.status}
                          effectiveStart={assessment.startTime}
                          isSubmitted={isSubmitted}
                          isInProgress={assessment.attemptStatus === "in_progress"}
                          serverNowMs={serverNowMs}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
