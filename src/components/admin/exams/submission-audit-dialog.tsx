"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileSearch,
  Maximize2,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getSubmissionAuditLogs,
  resetExamSubmission,
  resumeExamSubmission,
} from "@/actions/admin/exams";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AuditLogsResponse = Awaited<ReturnType<typeof getSubmissionAuditLogs>>;

interface SubmissionAuditDialogProps {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionSuccess?: () => void;
}

const PRESET_REASONS = [
  "Browser crash",
  "System issue",
  "Verified accidental termination",
  "Network interruption",
  "Other",
];

// Single source of truth for infraction metadata — counts, icon, and label
// live together so the summary strip and timeline badges can't drift apart.
const INFRACTION_META = {
  tab_switch: {
    label: "Tab switches",
    description: "Window minimized or focus lost",
    icon: AlertTriangle,
  },
  fullscreen_exit: {
    label: "Fullscreen exits",
    description: "Left required fullscreen view",
    icon: Maximize2,
  },
  paste: {
    label: "Paste attempts",
    description: "Unauthorized clipboard insertions",
    icon: Copy,
  },
} as const;

export function SubmissionAuditDialog({
  assignmentId,
  open,
  onOpenChange,
  onActionSuccess,
}: SubmissionAuditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const finalReason =
    selectedReason === "Other" ? customReason : selectedReason;

  const fetchLogs = () => {
    if (!assignmentId || !open) return;
    setLoading(true);
    getSubmissionAuditLogs(assignmentId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load audit logs");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && assignmentId) {
      setSelectedReason("");
      setCustomReason("");
      fetchLogs();
    } else {
      setData(null);
    }
  }, [open, assignmentId]);

  const handleResume = async () => {
    if (!assignmentId) return;
    if (!finalReason.trim()) {
      toast.error("Please select or enter a reason to resume attempt");
      return;
    }
    setActionLoading(true);
    try {
      const res = await resumeExamSubmission(assignmentId, finalReason.trim());
      if (res.success) {
        toast.success("Attempt resumed successfully");
        fetchLogs();
        onActionSuccess?.();
      } else {
        toast.error(res.error || "Failed to resume attempt");
      }
    } catch (_err) {
      toast.error("An error occurred while resuming attempt");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFullReset = async () => {
    if (!assignmentId) return;
    setActionLoading(true);
    try {
      const res = await resetExamSubmission(assignmentId, finalReason.trim());
      if (res.success) {
        toast.success("Attempt fully reset successfully");
        setShowConfirmReset(false);
        onOpenChange(false);
        onActionSuccess?.();
      } else {
        toast.error(res.error || "Failed to reset attempt");
      }
    } catch (_err) {
      toast.error("An error occurred while resetting attempt");
    } finally {
      setActionLoading(false);
    }
  };

  const assignment = data && data.success ? data.assignment : null;
  const timeline = (data && data.success ? data.timeline : undefined) ?? [];

  const tabSwitches = timeline.filter((e) => e.type === "tab_switch").length;
  const fullscreenExits = timeline.filter(
    (e) => e.type === "fullscreen_exit",
  ).length;
  const pasteAttempts = timeline.filter((e) => e.type === "paste").length;
  const totalWarnings = assignment?.malpracticeCount ?? 0;

  const infractionCounts = {
    tab_switch: tabSwitches,
    fullscreen_exit: fullscreenExits,
    paste: pasteAttempts,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-6 gap-0">
          <DialogHeader className="pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-primary" />
              Submission Audit Timeline
            </DialogTitle>
            <DialogDescription>
              Review student session lifecycle events, infractions, and perform
              verified administrative actions.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !assignment ? (
            <div className="py-8 text-center text-muted-foreground">
              {data && !data.success
                ? data.error
                : "No audit logs found for this submission."}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col mt-2 overflow-hidden">
              <ScrollArea className="flex-1 min-h-0 pr-3">
                <div className="flex flex-col gap-4 pb-2">
                  {/* 1. Attempt Summary — student identity, status, timing, score in one strip */}
                  <div className="bg-muted/30 p-3.5 rounded-lg border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block">
                        Student
                      </span>
                      <span className="font-semibold text-base truncate block mt-0.5">
                        {assignment.user?.name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate block">
                        {assignment.user?.username || assignment.user?.email || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block">
                        Status
                      </span>
                      <div className="mt-1.5">
                        <Badge
                          variant={
                            assignment.isTerminated
                              ? "destructive"
                              : assignment.status === "completed"
                                ? "default"
                                : "secondary"
                          }
                          className="capitalize px-2.5 py-0.5 text-xs font-semibold"
                        >
                          {assignment.isTerminated
                            ? "Terminated"
                            : assignment.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block">
                        Timing
                      </span>
                      <span className="text-xs font-medium block mt-1.5">
                        Started{" "}
                        {assignment.startedAt
                          ? new Date(assignment.startedAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : "-"}
                      </span>
                      <span className="text-xs block text-muted-foreground">
                        Ended{" "}
                        {assignment.completedAt
                          ? new Date(assignment.completedAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block">
                        Score
                      </span>
                      <span className="font-extrabold text-lg text-primary mt-0.5 block leading-none">
                        {assignment.score ?? 0} pts
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium block mt-0.5",
                          totalWarnings > 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {totalWarnings} warning{totalWarnings === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* 2. Infraction breakdown — one compact row instead of 4 separate cards.
                      Warnings is the consequence of these three, not a sibling metric,
                      so it's removed here and shown once, attached to score above. */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-3.5 py-2 border-b bg-muted/30 text-xs font-semibold text-foreground">
                      Infraction breakdown
                    </div>
                    <div className="grid grid-cols-3 divide-x">
                      {(
                        Object.entries(INFRACTION_META) as Array<
                          [keyof typeof INFRACTION_META, (typeof INFRACTION_META)[keyof typeof INFRACTION_META]]
                        >
                      ).map(([key, meta]) => {
                        const count = infractionCounts[key];
                        const Icon = meta.icon;
                        return (
                          <div
                            key={key}
                            className="p-3.5 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {meta.label}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-2xl font-bold leading-none",
                                count > 0 ? "text-amber-500" : "text-muted-foreground/50",
                              )}
                            >
                              {count}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {meta.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Chronological Lifecycle Timeline */}
                  <div className="flex flex-col border rounded-lg overflow-hidden">
                    <div className="px-3.5 py-2 border-b bg-muted/30 font-semibold text-xs text-foreground flex items-center justify-between">
                      <span>Session timeline</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                        {timeline.length} {timeline.length === 1 ? "event" : "events"}
                      </Badge>
                    </div>
                    <div className="p-3.5">
                      {timeline.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                          No events recorded during this attempt.
                        </div>
                      ) : (
                        <div className="space-y-3 pl-2 border-l-2 border-muted ml-2">
                          {timeline.map((ev) => {
                            const isTerminatedEv = ev.type === "auto_terminated";
                            const isResumeEv = ev.type === "invigilator_resume";
                            const isResetEv = ev.type === "invigilator_reset";
                            const isStartEv = ev.type === "exam_started";

                            let icon = (
                              <ShieldAlert className="w-4 h-4 text-amber-500" />
                            );
                            let badgeColor =
                              "bg-amber-500/10 text-amber-600 border-amber-500/20";
                            if (isTerminatedEv) {
                              icon = <XCircle className="w-4 h-4 text-destructive" />;
                              badgeColor =
                                "bg-destructive/15 text-destructive font-bold border-destructive/30";
                            } else if (isResumeEv || isResetEv) {
                              icon = <UserCheck className="w-4 h-4 text-blue-500" />;
                              badgeColor =
                                "bg-blue-500/10 text-blue-600 border-blue-500/20";
                            } else if (isStartEv) {
                              icon = (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              );
                              badgeColor =
                                "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                            }

                            return (
                              <div
                                key={ev.id}
                                className={cn(
                                  "relative pl-4 py-1.5 rounded pr-2",
                                  isTerminatedEv &&
                                    "bg-destructive/5 border border-destructive/20",
                                )}
                              >
                                <div className="absolute -left-[13px] top-2 bg-background rounded-full p-0.5 border">
                                  {icon}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded border capitalize",
                                        badgeColor,
                                      )}
                                    >
                                      {ev.type.replace(/_/g, " ")}
                                    </span>
                                    {ev.actor && (
                                      <span className="text-[11px] text-muted-foreground">
                                        by {ev.actor.name}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(ev.createdAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {ev.details && (
                                  <p className="text-xs text-muted-foreground mt-1 break-words">
                                    {ev.type.startsWith("invigilator_") &&
                                    ev.details.startsWith("{")
                                      ? tryParseReason(ev.details)
                                      : ev.details}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* 4. Action Footer & Required Reason — deliberately outside the
                  ScrollArea in the DOM tree, with its own solid background,
                  top border, and shadow so it can never visually blend with
                  scrolled timeline content above it. */}
              <div className="relative z-10 border-t pt-4 mt-3 shrink-0 bg-background shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.15)]">
                <div className="flex flex-col gap-3">
                  <div className="space-y-1.5 w-full">
                    <Label htmlFor="reason" className="text-sm font-semibold text-foreground">
                      Reason for administrative action{" "}
                      <span className="text-xs font-normal text-muted-foreground">(required for resume)</span>
                    </Label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <Select
                        value={selectedReason}
                        onValueChange={(val) => {
                          setSelectedReason(val);
                          if (val !== "Other") setCustomReason("");
                        }}
                      >
                        <SelectTrigger className="h-10 text-sm w-full sm:w-[220px] shrink-0 font-medium">
                          <SelectValue placeholder="Select reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_REASONS.map((r) => (
                            <SelectItem key={r} value={r} className="text-sm">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="reason"
                        placeholder="Type custom reason here..."
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        disabled={selectedReason !== "Other"}
                        className={cn(
                          "h-10 text-sm flex-1 min-w-[220px] transition-opacity",
                          selectedReason === "Other"
                            ? "opacity-100"
                            : "opacity-0 sm:opacity-40 pointer-events-none sm:pointer-events-none",
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => onOpenChange(false)}
                      className="h-9 px-3 font-semibold text-xs"
                    >
                      Close
                    </Button>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleResume}
                      disabled={
                        !assignment.isTerminated ||
                        !finalReason.trim() ||
                        actionLoading
                      }
                      className="h-9 px-3 gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 font-semibold text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Resume attempt
                    </Button>
                    <Button
                      variant="destructive"
                      size="default"
                      onClick={() => setShowConfirmReset(true)}
                      disabled={actionLoading}
                      className="h-9 px-3 font-semibold text-xs"
                    >
                      Full reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Strengthened Reset Confirmation */}
      <AlertDialog open={showConfirmReset} onOpenChange={setShowConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirm full attempt reset
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  You are about to perform a{" "}
                  <span className="font-semibold text-foreground">
                    full reset
                  </span>{" "}
                  for student{" "}
                  <span className="font-semibold text-foreground">
                    {assignment?.user?.name || "Unknown"}
                  </span>{" "}
                  with reason:{" "}
                  <span className="italic">&ldquo;{finalReason}&rdquo;</span>.
                </p>
                <div className="bg-destructive/10 p-3 rounded text-destructive text-xs space-y-1 font-medium">
                  <p>This action is irreversible and will permanently:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Remove all submitted code and test evaluations</li>
                    <li>Remove current assigned questions</li>
                    <li>Reset the exam timer to start fresh</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFullReset}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {actionLoading ? "Resetting..." : "Confirm full reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function tryParseReason(detailsStr: string) {
  try {
    const parsed = JSON.parse(detailsStr);
    if (parsed && typeof parsed.reason === "string") {
      return `Reason: ${parsed.reason}`;
    }
    return detailsStr;
  } catch (_e) {
    return detailsStr;
  }
}