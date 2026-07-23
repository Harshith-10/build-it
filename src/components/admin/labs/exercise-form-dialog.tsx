"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Trash2,
  Users,
  Loader2,
  Search,
  Library,
  X,
} from "lucide-react";
import { getGroups } from "@/actions/admin/groups";
import { getCollections } from "@/actions/admin/collections";
import { assignExerciseGroup, removeExerciseGroup } from "@/actions/admin/labs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Group = { id: string; name: string };
type Collection = { id: string; title: string; description?: string | null };

type ExistingWindow = {
  groupId: string;
  startTime: Date;
  endTime: Date;
};

type Exercise = {
  id: string;
  exerciseNo: number;
  title: string;
  description?: string | null;
  collectionId?: string | null;
  groups?: ExistingWindow[];
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const exerciseSchema = z.object({
  exerciseNo: z.coerce.number().min(1),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  collectionId: z.string().optional().nullable(),
});

type ExerciseFormValues = z.infer<typeof exerciseSchema>;

// ─── Helper ───────────────────────────────────────────────────────────────────

function toLocalDatetimeValue(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExerciseFormDialog({
  open,
  onClose,
  onSaved,
  labId,
  initial,
  onUpdateExercise,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  labId: string;
  initial?: Exercise;
  onUpdateExercise: (data: {
    id?: string;
    exerciseNo: number;
    title: string;
    description?: string;
    collectionId?: string | null;
    labId: string;
  }) => Promise<{ success: boolean; error?: string; exercise?: { id: string } }>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [windows, setWindows] = useState<
    { groupId: string; startTime: string; endTime: string }[]
  >([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [invalidWindows, setInvalidWindows] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<z.input<typeof exerciseSchema>, unknown, ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      exerciseNo: initial?.exerciseNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      collectionId: initial?.collectionId ?? null,
    },
  });

  // Reset on open
  useEffect(() => {
    form.reset({
      exerciseNo: initial?.exerciseNo ?? 1,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      collectionId: initial?.collectionId ?? null,
    });

    if (initial?.groups) {
      setWindows(
        initial.groups.map((g) => ({
          groupId: g.groupId,
          startTime: toLocalDatetimeValue(g.startTime),
          endTime: toLocalDatetimeValue(g.endTime),
        }))
      );
    } else {
      setWindows([]);
    }
    setSelectedGroupId("");
    setCollectionSearch("");
    setInvalidWindows(new Set());
  }, [initial, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch groups and collections when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingGroups(true);
    getGroups({ limit: 100 })
      .then((res) => setGroups(res.groups))
      .finally(() => setLoadingGroups(false));

    setLoadingCollections(true);
    getCollections({ limit: 50 })
      .then((res) => setCollections(res.collections))
      .finally(() => setLoadingCollections(false));
  }, [open]);

  // Debounced collection search
  const handleCollectionSearch = useCallback((query: string) => {
    setCollectionSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingCollections(true);
      try {
        const res = await getCollections({ limit: 50, search: query });
        setCollections(res.collections);
      } finally {
        setLoadingCollections(false);
      }
    }, 300);
  }, []);

  // ── Window management ────────────────────────────────────────────────────

  const addWindow = () => {
    if (!selectedGroupId) return;
    if (windows.find((w) => w.groupId === selectedGroupId)) {
      toast.error("This group already has a window assigned");
      return;
    }
    setWindows((prev) => [
      ...prev,
      { groupId: selectedGroupId, startTime: "", endTime: "" },
    ]);
    setSelectedGroupId("");
  };

  const removeWindow = (groupId: string) => {
    setWindows((prev) => prev.filter((w) => w.groupId !== groupId));
  };

  const updateWindow = (
    groupId: string,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setWindows((prev) =>
      prev.map((w) => (w.groupId === groupId ? { ...w, [field]: value } : w))
    );
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: ExerciseFormValues) => {
    // If a group is selected in the dropdown but not yet added via "+", warn the user
    if (selectedGroupId) {
      toast.error(
        "You have a group selected but haven't added it yet. Click the \"+\" button to add it, or clear the selection before saving."
      );
      return;
    }

    // Validate that every added group window has both times filled in
    const incomplete = windows
      .filter((w) => !w.startTime || !w.endTime)
      .map((w) => w.groupId);

    if (incomplete.length > 0) {
      setInvalidWindows(new Set(incomplete));
      toast.error(
        `Please set both start and end times for ${
          incomplete.length === 1
            ? "the highlighted group"
            : `all ${incomplete.length} highlighted groups`
        }.`
      );
      return;
    }

    setInvalidWindows(new Set());
    setIsSubmitting(true);
    try {
      const res = await onUpdateExercise({
        id: initial?.id,
        labId,
        ...data,
        collectionId: data.collectionId || null,
      });

      if (!res.success) {
        toast.error(res.error ?? "Failed to save exercise");
        return;
      }

      const exerciseId = initial?.id;

      if (exerciseId) {
        // Remove deleted windows
        const originalGroupIds = initial?.groups?.map((g) => g.groupId) ?? [];
        const newGroupIds = windows.map((w) => w.groupId);
        const removed = originalGroupIds.filter(
          (id) => !newGroupIds.includes(id)
        );
        for (const groupId of removed) {
          await removeExerciseGroup(exerciseId, groupId);
        }
        // Upsert current windows (all guaranteed to have times now)
        for (const window of windows) {
          await assignExerciseGroup({
            exerciseId,
            groupId: window.groupId,
            startTime: new Date(window.startTime),
            endTime: new Date(window.endTime),
          });
        }
      }

      toast.success(initial ? "Exercise updated" : "Exercise created");
      onSaved();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableGroups = groups.filter(
    (g) => !windows.find((w) => w.groupId === g.id)
  );

  const selectedCollection = collections.find(
    (c) => c.id === form.watch("collectionId")
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Exercise" : "Add Exercise"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Basic Details</TabsTrigger>
                <TabsTrigger value="collection">Collection</TabsTrigger>
              </TabsList>

              {/* ── Basic Details ── */}
              <TabsContent value="details" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="exerciseNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exercise Number</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} value={(field.value as number) ?? ""} />
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
                          placeholder="e.g. Classes and Objects"
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
                        <Input placeholder="Brief description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ── Group time windows (only for existing exercises) ── */}
                {initial && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Group Time Windows
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assign a time window per group — students can only submit
                      during their window.
                    </p>

                    {windows.map((w) => {
                      const group = groups.find((g) => g.id === w.groupId);
                      const isInvalid = invalidWindows.has(w.groupId);
                      return (
                        <div
                          key={w.groupId}
                          className={`border rounded-lg p-3 space-y-2 transition-colors ${
                            isInvalid
                              ? "border-destructive bg-destructive/5"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {group?.name ?? w.groupId}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeWindow(w.groupId)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                          {isInvalid && (
                            <p className="text-xs text-destructive font-medium">
                              Both start and end times are required.
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                <Clock className="inline h-3 w-3 mr-1" />
                                Start
                              </label>
                              <Input
                                type="datetime-local"
                                value={w.startTime}
                                onChange={(e) => {
                                  updateWindow(w.groupId, "startTime", e.target.value);
                                  if (e.target.value)
                                    setInvalidWindows((prev) => {
                                      const next = new Set(prev);
                                      if (windows.find((win) => win.groupId === w.groupId)?.endTime || w.endTime)
                                        next.delete(w.groupId);
                                      return next;
                                    });
                                }}
                                className={`text-xs ${
                                  isInvalid && !w.startTime ? "border-destructive" : ""
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                <Clock className="inline h-3 w-3 mr-1" />
                                End
                              </label>
                              <Input
                                type="datetime-local"
                                value={w.endTime}
                                onChange={(e) => {
                                  updateWindow(w.groupId, "endTime", e.target.value);
                                  if (e.target.value)
                                    setInvalidWindows((prev) => {
                                      const next = new Set(prev);
                                      if (windows.find((win) => win.groupId === w.groupId)?.startTime || w.startTime)
                                        next.delete(w.groupId);
                                      return next;
                                    });
                                }}
                                className={`text-xs ${
                                  isInvalid && !w.endTime ? "border-destructive" : ""
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {availableGroups.length > 0 && (
                      <div className="flex gap-2">
                        {loadingGroups ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Select
                              value={selectedGroupId}
                              onValueChange={setSelectedGroupId}
                            >
                              <SelectTrigger className="flex-1 text-sm">
                                <SelectValue placeholder="Select a group..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableGroups.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addWindow}
                              disabled={!selectedGroupId}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {windows.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2 border rounded-lg border-dashed">
                        No groups assigned yet.
                      </p>
                    )}
                  </div>
                )}

                {!initial && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    💡 You can assign group time windows after creating the
                    exercise by clicking the edit button.
                  </p>
                )}
              </TabsContent>

              {/* ── Collection Tab ── */}
              <TabsContent value="collection" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Link a collection to this exercise. Students will see the
                  questions in that collection as programs to solve.
                </p>

                {/* Currently selected collection */}
                {selectedCollection && (
                  <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Library className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {selectedCollection.title}
                        </p>
                        {selectedCollection.description && (
                          <p className="text-xs text-muted-foreground">
                            {selectedCollection.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => form.setValue("collectionId", null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search collections..."
                    value={collectionSearch}
                    onChange={(e) => handleCollectionSearch(e.target.value)}
                    className="pl-8"
                  />
                  {loadingCollections && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Collections list */}
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {collections.length === 0 && !loadingCollections ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No collections found
                    </div>
                  ) : (
                    collections.map((collection) => {
                      const isSelected =
                        form.watch("collectionId") === collection.id;
                      return (
                        <button
                          key={collection.id}
                          type="button"
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0 ${
                            isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                          }`}
                          onClick={() =>
                            form.setValue(
                              "collectionId",
                              isSelected ? null : collection.id
                            )
                          }
                        >
                          <Library className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {collection.title}
                            </p>
                            {collection.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {collection.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Selected
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>

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