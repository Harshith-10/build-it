"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { InferSelectModel } from "drizzle-orm";
import { Loader2, Pencil, Plus, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { upsertCollection } from "@/actions/admin/collections";
import { getProblems } from "@/actions/admin/problems";
import type { questions } from "@/db/schema/questions";

type Problem = InferSelectModel<typeof questions>;
type ProblemSummary = Pick<Problem, "id" | "title" | "difficulty">;

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

const collectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  description: z.string().default(""),
  questionIds: z.array(z.string()).default([]),
});

type CollectionFormInput = z.input<typeof collectionSchema>;
type CollectionFormValues = z.output<typeof collectionSchema>;

const difficultyColors: Record<string, string> = {
  easy: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  hard: "text-rose-400 border-rose-400/30 bg-rose-400/10",
};

export function CollectionForm({
  initialData,
  basePath = "/admin",
}: {
  initialData?: Partial<z.infer<typeof collectionSchema>> & {
    questions?: { questionId: string; question: ProblemSummary }[];
  };
  basePath?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<ProblemSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<CollectionFormInput, unknown, CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      id: initialData?.id,
      title: initialData?.title || "",
      description: initialData?.description || "",
      questionIds:
        initialData?.questions?.map((q) => q.questionId) || [],
    },
  });

  // Initialize selected problems from pre-loaded data
  useEffect(() => {
    getProblems({ limit: 50 }).then((res) =>
      setAvailableProblems(res.problems),
    );
    if (initialData?.questions?.length) {
      setSelectedProblems(initialData.questions.map((q) => q.question));
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
          limit: 50,
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
        router.push(`${basePath}/collections`);
      } else {
        toast.error("Failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedIds = form.watch("questionIds") ?? [];

  const toggleProblem = (problem: ProblemSummary) => {
    const current = form.getValues("questionIds") ?? [];
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
    const current = form.getValues("questionIds") ?? [];
    form.setValue(
      "questionIds",
      current.filter((cid) => cid !== id),
    );
    setSelectedProblems((prev) => prev.filter((p) => p.id !== id));
  };

  // Filter available to exclude already-selected
  const filteredAvailable = availableProblems.filter(
    (p) => !selectedIds.includes(p.id),
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 flex-col min-h-0 gap-4"
      >
        {/* Title & Description fields */}
        <div className="grid gap-4 md:grid-cols-2 shrink-0">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
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
            render={({ field }) => (
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

        {/* Problems picker - fills remaining space */}
        <div className="flex-1 min-h-0 border rounded-lg flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or difficulty..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Two-column layout: Available | Selected */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Available column */}
            <div className="flex-1 flex flex-col min-h-0 border-r">
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider shrink-0 border-b">
                Available ({filteredAvailable.length})
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-0.5">
                  {filteredAvailable.map((problem) => (
                    <button
                      key={problem.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-muted transition-colors group"
                      onClick={() => toggleProblem(problem)}
                    >
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div className="flex-1 text-sm font-medium text-left truncate">
                        {problem.title}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${difficultyColors[problem.difficulty] || ""}`}
                      >
                        {problem.difficulty}
                      </Badge>
                    </button>
                  ))}
                  {filteredAvailable.length === 0 && !isSearching && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {search
                        ? "No problems match your search"
                        : "No problems available"}
                    </div>
                  )}
                  {isSearching && filteredAvailable.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected column */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider shrink-0 border-b flex justify-between">
                <span>Selected ({selectedIds.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {selectedIds.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Click problems on the left to add them
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {selectedIds
                      .filter((id) => {
                        if (!search) return true;
                        const problem = selectedProblems.find(
                          (p) => p.id === id,
                        );
                        return problem?.title
                          .toLowerCase()
                          .includes(search.toLowerCase());
                      })
                      .map((id) => {
                        const problem = selectedProblems.find(
                          (p) => p.id === id,
                        );
                        return (
                          <div
                            key={id}
                            className="flex w-full border my-2 items-center gap-2 px-3 py-2 rounded-md hover:border-primary transition-colors cursor-pointer"
                          >
                            <div className="flex-1 min-w-0 text-sm font-medium text-left truncate">
                              {problem?.title || "Unknown Problem"}
                            </div>

                            {problem && (
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${difficultyColors[problem.difficulty] || ""}`}
                              >
                                {problem.difficulty}
                              </Badge>
                            )}
                            {problem && (
                              <Link href={`${basePath}/problems/${id}`}>
                                <Button variant="outline" size="icon-sm">
                                  <Pencil />
                                </Button>
                              </Link>
                            )}
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => removeProblem(id)}
                              aria-label={`Remove ${problem?.title || "problem"}`}
                            >
                              <X />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions — always at bottom, never pushed off */}
        <div className="shrink-0 flex justify-end gap-3 pt-2">
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
