"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  BookOpen,
  CalendarClock,
  Eye,
  Clock,
  Library,
} from "lucide-react";

import {
  getLabs,
  createLab,
  updateLab,
  deleteLab,
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  scheduleExerciseForSemester,
} from "@/actions/admin/labs";

import { ExerciseFormDialog } from "@/components/admin/labs/exercise-form-dialog";
import { ExerciseSubmissionsDialog } from "@/components/admin/labs/exercise-submissions-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────

type Lab = Awaited<ReturnType<typeof getLabs>>[number];
type Exercise = Awaited<ReturnType<typeof getExercises>>[number];

type View = "labs" | "exercises";

// ─── Schemas ────────────────────────────────────────────────────────────────

const labSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  semester: z.preprocess((v) => Number(v), z.number().min(1).max(4)),
  description: z.string().optional(),
});

const scheduleSchema = z
  .object({
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

const SEM_LABELS: Record<number, string> = {
  1: "Semester 1",
  2: "Semester 2",
  3: "Semester 3",
  4: "Semester 4",
};

const SEM_COLORS: Record<number, string> = {
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-teal-100 text-teal-700 border-teal-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
};

// ─── Lab Form Dialog ────────────────────────────────────────────────────────

function LabFormDialog({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Lab;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof labSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(labSchema) as any,
    defaultValues: {
      name: initial?.name ?? "",
      semester: initial?.semester ?? 1,
      description: initial?.description ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: initial?.name ?? "",
      semester: initial?.semester ?? 1,
      description: initial?.description ?? "",
    });
  }, [initial, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: z.infer<typeof labSchema>) => {
    setIsSubmitting(true);
    try {
      const res = initial
        ? await updateLab({ id: initial.id, ...data })
        : await createLab(data);

      if (res.success) {
        toast.success(initial ? "Lab updated" : "Lab created");
        onSaved();
        onClose();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Lab" : "Add Lab"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lab Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. OOPS Lab" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="semester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semester</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4].map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {SEM_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule Dialog ────────────────────────────────────────────────────────

function ScheduleDialog({
  open,
  onClose,
  onSaved,
  exercise,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  exercise: Exercise;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingWindow = exercise.groups?.[0];
  const toDatetimeLocal = (d: Date | string | null | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().slice(0, 16);
  };

  const form = useForm<z.infer<typeof scheduleSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(scheduleSchema) as any,
    defaultValues: {
      startTime: toDatetimeLocal(existingWindow?.startTime),
      endTime: toDatetimeLocal(existingWindow?.endTime),
    },
  });

  useEffect(() => {
    const w = exercise.groups?.[0];
    form.reset({
      startTime: toDatetimeLocal(w?.startTime),
      endTime: toDatetimeLocal(w?.endTime),
    });
  }, [exercise, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: z.infer<typeof scheduleSchema>) => {
    setIsSubmitting(true);
    try {
      const res = await scheduleExerciseForSemester({
        exerciseId: exercise.id,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      });

      if (res.success) {
        toast.success(
          `Scheduled for ${res.groupsScheduled} group${res.groupsScheduled !== 1 ? "s" : ""}`
        );
        onSaved();
        onClose();
      } else {
        toast.error(res.error ?? "Failed to schedule");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Schedule Exercise {exercise.exerciseNo}
          </DialogTitle>
          <DialogDescription>
            Set the time window for <strong>{exercise.title}</strong>. This
            will automatically apply to all students in this semester.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {existingWindow && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Currently scheduled — saving will update all groups.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {existingWindow ? "Update Schedule" : "Set Schedule"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function LabsManager() {
  const [view, setView] = useState<View>("labs");
  const [loading, setLoading] = useState(true);

  const [labs, setLabs] = useState<Lab[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);

  const [labDialog, setLabDialog] = useState(false);
  const [exerciseDialog, setExerciseDialog] = useState(false);
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [editingLab, setEditingLab] = useState<Lab | undefined>();
  const [editingExercise, setEditingExercise] = useState<
    Exercise | undefined
  >();
  const [schedulingExercise, setSchedulingExercise] =
    useState<Exercise | null>(null);
  const [submissionsExercise, setSubmissionsExercise] =
    useState<Exercise | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchLabs = async () => {
    setLoading(true);
    try {
      const data = await getLabs();
      setLabs(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async (labId: string) => {
    setLoading(true);
    try {
      const data = await getExercises(labId);
      setExercises(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const openLab = (lab: Lab) => {
    setSelectedLab(lab);
    fetchExercises(lab.id);
    setView("exercises");
  };

  const goToLabs = () => {
    setView("labs");
    setSelectedLab(null);
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDeleteLab = async (id: string) => {
    const res = await deleteLab(id);
    if (res.success) {
      toast.success("Lab deleted");
      fetchLabs();
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
  };

  const handleDeleteExercise = async (id: string) => {
    const res = await deleteExercise(id);
    if (res.success) {
      toast.success("Exercise deleted");
      if (selectedLab) fetchExercises(selectedLab.id);
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <button
          onClick={goToLabs}
          className={
            view === "labs"
              ? "font-medium text-foreground"
              : "hover:text-foreground transition-colors"
          }
        >
          Labs
        </button>
        {selectedLab && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">
              {selectedLab.name}
            </span>
          </>
        )}
      </div>

      {/* ── Labs View ── */}
      {view === "labs" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {labs.length} lab{labs.length !== 1 ? "s" : ""} configured
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingLab(undefined);
                setLabDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Lab
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {labs.map((lab) => (
              <div
                key={lab.id}
                className="border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer min-w-0"
                onClick={() => openLab(lab)}
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {lab.name}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${SEM_COLORS[lab.semester]}`}
                  >
                    Sem {lab.semester}
                  </Badge>
                </div>
                {lab.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                    {lab.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {lab.exercises?.length ?? 0} exercise{(lab.exercises?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <div
                    className="flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingLab(lab);
                        setLabDialog(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Lab</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete{" "}
                            <strong>{lab.name}</strong> and all its exercises.
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteLab(lab.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
            {labs.length === 0 && (
              <div className="col-span-full text-center py-12 border rounded-lg text-sm text-muted-foreground">
                No labs yet. Click &quot;Add Lab&quot; to get started.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Exercises View ── */}
      {view === "exercises" && selectedLab && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingExercise(undefined);
                setExerciseDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Exercise
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {exercises.map((exercise) => {
              const hasSchedule =
                exercise.groups && exercise.groups.length > 0;
              const window = exercise.groups?.[0];
              const now = new Date();
              const isActive =
                hasSchedule &&
                window?.startTime &&
                window?.endTime &&
                now >= new Date(window.startTime) &&
                now <= new Date(window.endTime);

              // collection info
              const collection = (exercise as any).collection;

              return (
                <div
                  key={exercise.id}
                  className="border rounded-lg p-4 flex items-center gap-4 hover:border-primary/50 transition-colors min-w-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-medium shrink-0">
                    {exercise.exerciseNo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {exercise.title}
                    </p>
                    {/* Collection info */}
                    {collection ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Library className="h-3 w-3 shrink-0" />
                        <span className="truncate">{collection.name}</span>
                        {collection.questions?.length != null && (
                          <span className="ml-1 shrink-0">
                            · {collection.questions.length} programs
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        No collection linked
                      </p>
                    )}
                    {/* Schedule info */}
                    {hasSchedule && window?.startTime && window?.endTime && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {new Date(window.startTime).toLocaleString()} →{" "}
                          {new Date(window.endTime).toLocaleString()}
                        </span>
                        {isActive && (
                          <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasSchedule ? (
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? "text-xs bg-green-50 text-green-700 border-green-200"
                            : "text-xs bg-muted text-muted-foreground"
                        }
                      >
                        {isActive ? "Active" : "Scheduled"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        Not Scheduled
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="View submissions"
                        onClick={() => setSubmissionsExercise(exercise)}
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit exercise"
                        onClick={() => {
                          setEditingExercise(exercise);
                          setExerciseDialog(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete Exercise {exercise.exerciseNo}{" "}
                              permanently.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() =>
                                handleDeleteExercise(exercise.id)
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
            {exercises.length === 0 && (
              <div className="text-center py-12 border rounded-lg text-sm text-muted-foreground">
                No exercises yet. Click &quot;Add Exercise&quot; to get
                started.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Dialogs ── */}
      <LabFormDialog
        open={labDialog}
        onClose={() => setLabDialog(false)}
        onSaved={fetchLabs}
        initial={editingLab}
      />
      {selectedLab && (
        <ExerciseFormDialog
          open={exerciseDialog}
          onClose={() => setExerciseDialog(false)}
          onSaved={() => fetchExercises(selectedLab.id)}
          labId={selectedLab.id}
          initial={editingExercise}
          onUpdateExercise={async (data) => {
            return data.id
              ? await updateExercise({
                  id: data.id,
                  exerciseNo: data.exerciseNo,
                  title: data.title,
                  description: data.description,
                  collectionId: data.collectionId ?? null,
                })
              : await createExercise({
                  labId: data.labId,
                  exerciseNo: data.exerciseNo,
                  title: data.title,
                  description: data.description,
                  collectionId: data.collectionId ?? null,
                });
          }}
        />
      )}
      {submissionsExercise && (
        <ExerciseSubmissionsDialog
          open={!!submissionsExercise}
          onClose={() => setSubmissionsExercise(null)}
          exerciseId={submissionsExercise.id}
          exerciseTitle={submissionsExercise.title}
          exerciseNo={submissionsExercise.exerciseNo}
        />
      )}
    </div>
  );
}