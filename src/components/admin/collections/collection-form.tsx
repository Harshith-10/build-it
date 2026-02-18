"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { InferSelectModel } from "drizzle-orm";
import { Loader2, Save, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { upsertCollection } from "@/actions/admin/collections";
import { getProblems } from "@/actions/admin/problems";
import type { questions } from "@/db/schema/questions";

type Problem = InferSelectModel<typeof questions>;

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const collectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  questionIds: z.array(z.string()).default([]),
});

type CollectionFormValues = z.infer<typeof collectionSchema>;

export function CollectionForm({
  initialData,
}: {
  initialData?: Partial<z.infer<typeof collectionSchema>> & {
    questions?: { questionId: string }[];
  };
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<Problem[]>([]);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<CollectionFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: Bypass strict Zod types
    resolver: zodResolver(collectionSchema) as any,
    defaultValues: {
      id: initialData?.id,
      title: initialData?.title || "",
      description: initialData?.description || "",
      questionIds: (initialData?.questions?.map(
        (q: { questionId: string }) => q.questionId,
      ) || []) as string[],
    } as any,
  });

  // Initial load: fetch selected problems and first batch of available
  useEffect(() => {
    // Load first 20 problems for initial display
    getProblems({ limit: 20 }).then((res) =>
      setAvailableProblems(res.problems),
    );
    // If editing, also load the selected problems' data
    const ids = initialData?.questions?.map((q) => q.questionId) || [];
    if (ids.length > 0) {
      getProblems({ limit: 100 }).then((res) => {
        setSelectedProblems(res.problems.filter((p) => ids.includes(p.id)));
      });
    }
  }, [initialData?.questions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await getProblems({
          limit: 20,
          search: query,
        });
        setAvailableProblems(res.problems);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const onSubmit = async (data: CollectionFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await upsertCollection(data);
      if (res.success) {
        toast.success("Collection saved");
        router.push("/admin/collections");
      } else {
        toast.error("Failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedIds = form.watch("questionIds");

  const toggleProblem = (problem: Problem) => {
    const current = form.getValues("questionIds");
    if (current.includes(problem.id)) {
      form.setValue(
        "questionIds",
        current.filter((cid) => cid !== problem.id),
      );
      setSelectedProblems((prev) => prev.filter((p) => p.id !== problem.id));
    } else {
      form.setValue("questionIds", [...current, problem.id]);
      setSelectedProblems((prev) => [...prev, problem]);
    }
  };

  const removeProblem = (id: string) => {
    const current = form.getValues("questionIds");
    form.setValue(
      "questionIds",
      current.filter((cid) => cid !== id),
    );
    setSelectedProblems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 h-full flex flex-col"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            // biome-ignore lint/suspicious/noExplicitAny: Temporary fix for strict Zod types
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Arrays & Strings" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            // biome-ignore lint/suspicious/noExplicitAny: Temporary fix for strict Zod types
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="Collection description..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex-1 min-h-[400px] border rounded-md flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/10">
            <h3 className="font-semibold mb-2">Manage Questions</h3>
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search problems..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 border-r flex flex-col">
              <div className="p-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider">
                Available ({availableProblems.length})
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {availableProblems.map((problem) => {
                    const isSelected = selectedIds.includes(problem.id);
                    return (
                      <button
                        key={problem.id}
                        type="button"
                        className={`flex w-full items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${isSelected ? "opacity-50" : ""}`}
                        onClick={() => !isSelected && toggleProblem(problem)}
                      >
                        <div className="flex-1 text-sm font-medium text-left">
                          {problem.title}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {problem.difficulty}
                        </Badge>
                      </button>
                    );
                  })}
                  {availableProblems.length === 0 && !isSearching && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      {search
                        ? "No problems match your search"
                        : "No problems available"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="p-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider flex justify-between">
                <span>Selected ({selectedIds.length})</span>
                <span className="text-xs text-muted-foreground">
                  Click to remove
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {selectedIds.map((id) => {
                    const problem = selectedProblems.find((p) => p.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="flex w-full items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-destructive/10 text-primary hover:text-destructive group"
                        onClick={() => removeProblem(id)}
                      >
                        <div className="flex-1 text-sm font-medium text-left">
                          {problem?.title || "Unknown Problem"}
                        </div>
                        <X className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur p-4 border-t flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Collection
          </Button>
        </div>
      </form>
    </Form>
  );
}
