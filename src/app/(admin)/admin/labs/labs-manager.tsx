"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen,
  ChevronRight,
  Code2,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import {
  createExercise,
  createLab,
  createProgram,
  deleteExercise,
  deleteLab,
  deleteProgram,
  getExercises,
  getLabs,
  getPrograms,
  updateExercise,
  updateLab,
  updateProgram,
} from "@/actions/admin/labs";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lab = Awaited<ReturnType<typeof getLabs>>[number];
type Exercise = Awaited<ReturnType<typeof getExercises>>[number];
type Program = Awaited<ReturnType<typeof getPrograms>>[number];

type View = "labs" | "exercises" | "programs";

type DeleteTarget =
  | {
      type: "lab";
      id: string;
      entityName: string;
      description: string;
    }
  | {
      type: "exercise";
      id: string;
      entityName: string;
      description: string;
    }
  | {
      type: "program";
      id: string;
      entityName: string;
      description: string;
    };

// ─── Schemas ──────────────────────────────────────────────────────────────────

const labSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  semester: z.coerce.number().min(1).max(4),
  description: z.string().optional(),
});

const exerciseSchema = z.object({
  exerciseNo: z.coerce.number().min(1).max(12),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
});

const programSchema = z.object({
  programNo: z.coerce.number().min(1).max(8),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
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

// ─── Lab Form Dialog ──────────────────────────────────────────────────────────

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
  const form = useForm<
    z.input<typeof labSchema>,
    unknown,
    z.output<typeof labSchema>
  >({
    resolver: zodResolver(labSchema),
    defaultValues: {
      name: initial?.name ?? "",
      semester: initial?.semester ?? 1,
      description: initial?.description ?? "",
    } as z.infer<typeof labSchema>,
  });

  useEffect(() => {
    form.reset({
      name: initial?.name ?? "",
      semester: initial?.semester ?? 1,
      description: initial?.description ?? "",
    });
  }, [initial, form.reset]); // eslint-disable-line react-hooks/exhaustive-deps

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

// ─── Exercise Form Dialog ─────────────────────────────────────────────────────

function ExerciseFormDialog({
  open,
  onClose,
  onSaved,
  labId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  labId: string;
  initial?: Exercise;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<
    z.input<typeof exerciseSchema>,
    unknown,
    z.output<typeof exerciseSchema>
  >({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      exerciseNo: initial?.exerciseNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
    } as z.infer<typeof exerciseSchema>,
  });

  useEffect(() => {
    form.reset({
      exerciseNo: initial?.exerciseNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
    });
  }, [initial, form.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: z.infer<typeof exerciseSchema>) => {
    setIsSubmitting(true);
    try {
      const res = initial
        ? await updateExercise({ id: initial.id, ...data })
        : await createExercise({ labId, ...data });

      if (res.success) {
        toast.success(initial ? "Exercise updated" : "Exercise created");
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
          <DialogTitle>
            {initial ? "Edit Exercise" : "Add Exercise"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="exerciseNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercise Number (1–12)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      {...field}
                      value={field.value as string | number}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Classes and Objects" {...field} />
                  </FormControl>
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

// ─── Program Form Dialog ──────────────────────────────────────────────────────

function ProgramFormDialog({
  open,
  onClose,
  onSaved,
  exerciseId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  exerciseId: string;
  initial?: Program;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<
    z.input<typeof programSchema>,
    unknown,
    z.output<typeof programSchema>
  >({
    resolver: zodResolver(programSchema),
    defaultValues: {
      programNo: initial?.programNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
    } as z.infer<typeof programSchema>,
  });

  useEffect(() => {
    form.reset({
      programNo: initial?.programNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
    });
  }, [initial, form.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: z.infer<typeof programSchema>) => {
    setIsSubmitting(true);
    try {
      const res = initial
        ? await updateProgram({ id: initial.id, ...data })
        : await createProgram({ exerciseId, ...data });

      if (res.success) {
        toast.success(initial ? "Program updated" : "Program created");
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
          <DialogTitle>{initial ? "Edit Program" : "Add Program"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="programNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Number (1–8)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      {...field}
                      value={field.value as string | number}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Create a Student class"
                      {...field}
                    />
                  </FormControl>
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
                    <Input
                      placeholder="What should the student do..."
                      {...field}
                    />
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function LabsManager() {
  const [view, setView] = useState<View>("labs");
  const [loading, setLoading] = useState(true);

  const [labs, setLabs] = useState<Lab[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(
    null,
  );

  // Dialog state
  const [labDialog, setLabDialog] = useState(false);
  const [exerciseDialog, setExerciseDialog] = useState(false);
  const [programDialog, setProgramDialog] = useState(false);
  const [editingLab, setEditingLab] = useState<Lab | undefined>();
  const [editingExercise, setEditingExercise] = useState<
    Exercise | undefined
  >();
  const [editingProgram, setEditingProgram] = useState<Program | undefined>();

  // ── Data fetching ──────────────────────────────────────────────────────────

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

  const fetchPrograms = async (exerciseId: string) => {
    setLoading(true);
    try {
      const data = await getPrograms(exerciseId);
      setPrograms(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const openLab = (lab: Lab) => {
    setSelectedLab(lab);
    fetchExercises(lab.id);
    setView("exercises");
  };

  const openExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    fetchPrograms(exercise.id);
    setView("programs");
  };

  const goToLabs = () => {
    setView("labs");
    setSelectedLab(null);
    setSelectedExercise(null);
  };

  const goToExercises = () => {
    setView("exercises");
    setSelectedExercise(null);
    if (selectedLab) fetchExercises(selectedLab.id);
  };

  // ── Delete handlers ────────────────────────────────────────────────────────

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

  const handleDeleteProgram = async (id: string) => {
    const res = await deleteProgram(id);
    if (res.success) {
      toast.success("Program deleted");
      if (selectedExercise) fetchPrograms(selectedExercise.id);
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    const target = pendingDelete;
    setPendingDelete(null);

    if (target.type === "lab") {
      await handleDeleteLab(target.id);
      return;
    }

    if (target.type === "exercise") {
      await handleDeleteExercise(target.id);
      return;
    }

    await handleDeleteProgram(target.id);
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
            <button
              onClick={goToExercises}
              className={
                view === "exercises"
                  ? "font-medium text-foreground"
                  : "hover:text-foreground transition-colors"
              }
            >
              {selectedLab.name}
            </button>
          </>
        )}
        {selectedExercise && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">
              Exercise {selectedExercise.exerciseNo}
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
                className="border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openLab(lab)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm">{lab.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${SEM_COLORS[lab.semester]}`}
                  >
                    Sem {lab.semester}
                  </Badge>
                </div>
                {lab.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {lab.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {lab.exercises?.length ?? 0}/12 exercises
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setPendingDelete({
                          type: "lab",
                          id: lab.id,
                          entityName: "Lab",
                          description: `This will permanently delete ${lab.name} and all its exercises and programs. This cannot be undone.`,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
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
              {exercises.length}/12 exercises
            </p>
            <Button
              size="sm"
              disabled={exercises.length >= 12}
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
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="border rounded-lg p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openExercise(exercise)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-medium shrink-0">
                  {exercise.exerciseNo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{exercise.title}</p>
                  {exercise.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {exercise.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    <BookOpen className="inline h-3 w-3 mr-1" />
                    {exercise.programs?.length ?? 0}/8
                  </span>
                  <div
                    className="flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingExercise(exercise);
                        setExerciseDialog(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setPendingDelete({
                          type: "exercise",
                          id: exercise.id,
                          entityName: "Exercise",
                          description: `This will delete Exercise ${exercise.exerciseNo} and all its programs permanently.`,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {exercises.length === 0 && (
              <div className="text-center py-12 border rounded-lg text-sm text-muted-foreground">
                No exercises yet. Click &quot;Add Exercise&quot; to get started.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Programs View ── */}
      {view === "programs" && selectedExercise && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {programs.length}/8 programs
            </p>
            <Button
              size="sm"
              disabled={programs.length >= 8}
              onClick={() => {
                setEditingProgram(undefined);
                setProgramDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Program
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {programs.map((program) => (
              <div
                key={program.id}
                className="border rounded-lg p-4 flex items-center gap-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-medium shrink-0">
                  <Code2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {program.programNo}. {program.title}
                  </p>
                  {program.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {program.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditingProgram(program);
                      setProgramDialog(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setPendingDelete({
                        type: "program",
                        id: program.id,
                        entityName: "Program",
                        description: `This will permanently delete "${program.title}".`,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {programs.length === 0 && (
              <div className="text-center py-12 border rounded-lg text-sm text-muted-foreground">
                No programs yet. Click &quot;Add Program&quot; to get started.
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
        />
      )}
      {selectedExercise && (
        <ProgramFormDialog
          open={programDialog}
          onClose={() => setProgramDialog(false)}
          onSaved={() => fetchPrograms(selectedExercise.id)}
          exerciseId={selectedExercise.id}
          initial={editingProgram}
        />
      )}
      <ConfirmDeleteDialog
        entityName={pendingDelete?.entityName ?? "Item"}
        description={pendingDelete?.description ?? ""}
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
