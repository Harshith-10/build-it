"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Loader2, Calendar } from "lucide-react";
import { getGroups } from "@/actions/admin/groups";
import {
  assignExerciseGroup,
  removeExerciseGroup,
  getLabGroupFaculty,
} from "@/actions/admin/labs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Group = { id: string; name: string };

type ExistingWindow = {
  groupId: string;
  startTime: Date;
  endTime: Date;
};

type Exercise = {
  id: string;
  exerciseNo: number;
  title: string;
  labId: string;
  groups?: ExistingWindow[];
};

export function ScheduleWindowDialog({
  open,
  onClose,
  onSaved,
  exercise,
  isAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  exercise?: Exercise;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [windows, setWindows] = useState<ExistingWindow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // New window form state
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [savingWindow, setSavingWindow] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!exercise) return;
    setLoadingGroups(true);
    try {
      if (isAdmin) {
        const res = await getGroups({ limit: 100 });
        setAvailableGroups(
          res.groups
            .filter(
              (g) =>
                g.name.toLowerCase() !== "all" &&
                g.name.toLowerCase() !== "all users" &&
                g.id !== "all-users-virtual"
            )
            .map((g) => ({ id: g.id, name: g.name }))
        );
      } else {
        // Fetch groups assigned to this faculty member for this lab
        const facultyAssignments = await getLabGroupFaculty(exercise.labId);
        // Map assignments to group list format
        const assignedGroups = facultyAssignments
          .filter(
            (fa) =>
              fa.groupName.toLowerCase() !== "all" &&
              fa.groupName.toLowerCase() !== "all users" &&
              fa.groupId !== "all-users-virtual"
          )
          .map((fa) => ({
            id: fa.groupId,
            name: fa.groupName,
          }));
        setAvailableGroups(assignedGroups);
      }
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [exercise, isAdmin]);

  useEffect(() => {
    if (open && exercise) {
      setWindows(exercise.groups ?? []);
      fetchGroups();
      setSelectedGroupId("");
      setStartTime("");
      setEndTime("");
    }
  }, [open, exercise, fetchGroups]);

  const handleAddWindow = async () => {
    if (!exercise) return;
    if (!selectedGroupId) {
      toast.error("Please select a student group/section");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Please specify both start and end times");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    setSavingWindow(true);
    try {
      const res = await assignExerciseGroup({
        exerciseId: exercise.id,
        groupId: selectedGroupId,
        startTime: start,
        endTime: end,
      });

      if (res.success && res.group) {
        toast.success("Schedule window updated successfully");
        setWindows((prev) => {
          const filtered = prev.filter((w) => w.groupId !== selectedGroupId);
          return [
            ...filtered,
            { groupId: selectedGroupId, startTime: start, endTime: end },
          ];
        });
        setSelectedGroupId("");
        setStartTime("");
        setEndTime("");
        router.refresh();
        onSaved();
        onClose();
      } else {
        toast.error(res.error ?? "Failed to save schedule window");
      }
    } catch (err) {
      toast.error("An error occurred while saving the schedule window");
    } finally {
      setSavingWindow(false);
    }
  };

  const handleRemoveWindow = async (groupId: string) => {
    if (!exercise) return;
    try {
      const res = await removeExerciseGroup(exercise.id, groupId);
      if (res.success) {
        toast.success("Schedule window removed");
        setWindows((prev) => prev.filter((w) => w.groupId !== groupId));
        router.refresh();
        onSaved();
      } else {
        toast.error(res.error ?? "Failed to remove window");
      }
    } catch (err) {
      toast.error("Failed to remove window");
    }
  };

  if (!exercise) return null;

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (val) {
      const startDate = new Date(val);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
        const pad = (n: number) => n.toString().padStart(2, "0");
        const localEndString = `${endDate.getFullYear()}-${pad(
          endDate.getMonth() + 1
        )}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(
          endDate.getMinutes()
        )}`;
        setEndTime(localEndString);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Schedule Exercise {exercise.exerciseNo}: {exercise.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* List existing active/scheduled windows */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Section Schedules
            </h4>
            {windows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2 border rounded-md px-3 bg-muted/40">
                No time windows set for any section yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {windows.map((w) => {
                  const grp = availableGroups.find((g) => g.id === w.groupId);
                  const grpName = grp?.name ?? "Section/Group";
                  const now = new Date();
                  const start = new Date(w.startTime);
                  const end = new Date(w.endTime);
                  const isActive = now >= start && now <= end;

                  return (
                    <div
                      key={w.groupId}
                      className="flex items-center justify-between p-2.5 border rounded-lg bg-card text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{grpName}</span>
                          <Badge
                            variant="outline"
                            className={
                              isActive
                                ? "text-[10px] bg-green-50 text-green-700 border-green-200"
                                : "text-[10px] bg-muted text-muted-foreground"
                            }
                          >
                            {isActive ? "Active Now" : "Scheduled"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px] truncate">
                          {start.toLocaleString()} → {end.toLocaleString()}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveWindow(w.groupId)}
                        title="Remove schedule window"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="my-2" />

          {/* Add / Update Window Form */}
          <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Set Time Window
            </h4>

            {loadingGroups ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading your assigned sections...
              </div>
            ) : availableGroups.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-2 rounded">
                No sections are assigned to you for this lab.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Select Section / Group</label>
                  <select
                    className="w-full text-xs h-8 rounded-md border border-input bg-background px-2.5 py-1"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                  >
                    <option value="">-- Select Section --</option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Start Time</label>
                    <Input
                      type="datetime-local"
                      className="text-xs h-8"
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">End Time (+3 hrs default)</label>
                    <Input
                      type="datetime-local"
                      className="text-xs h-8"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full mt-2 h-8 text-xs"
                  onClick={handleAddWindow}
                  disabled={savingWindow || !selectedGroupId}
                >
                  {savingWindow ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save Schedule Window
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
