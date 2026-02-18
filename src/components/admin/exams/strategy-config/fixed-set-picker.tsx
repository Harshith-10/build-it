"use client";

import { Loader2, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProblems } from "@/actions/admin/problems";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FixedSetPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function FixedSetPicker({ value = [], onChange }: FixedSetPickerProps) {
  const [problems, setProblems] = useState<any[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load
  useEffect(() => {
    getProblems({ limit: 20 }).then((res) => setProblems(res.problems));
  }, []);

  // Load selected problems' data on mount
  useEffect(() => {
    if (value.length > 0) {
      getProblems({ limit: 100 }).then((res) => {
        setSelectedProblems(res.problems.filter((p) => value.includes(p.id)));
      });
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await getProblems({ limit: 20, search: query });
        setProblems(res.problems);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const addProblem = (problem: any) => {
    if (!value.includes(problem.id)) {
      onChange([...value, problem.id]);
      setSelectedProblems((prev) => [...prev, problem]);
    }
  };

  const removeProblem = (id: string) => {
    onChange(value.filter((v) => v !== id));
    setSelectedProblems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="h-[400px] border rounded-md overflow-hidden flex flex-col">
      <div className="p-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search problems..."
            className="pl-8"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {isSearching && (
            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Available */}
        <div className="flex-1 border-r flex flex-col">
          <div className="p-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider">
            Available Problems
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {problems.map((p) => {
                const isSelected = value.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted ${isSelected ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => addProblem(p)}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-sm">{p.title}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] w-fit mt-0.5"
                      >
                        {p.difficulty}
                      </Badge>
                    </div>
                    {!isSelected && (
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
              {problems.length === 0 && !isSearching && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {search
                    ? "No problems match your search"
                    : "No problems available"}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        {/* Selected */}
        <div className="flex-1 flex flex-col">
          <div className="p-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider flex justify-between items-center">
            <span>Selected ({value.length})</span>
            {value.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange([]);
                  setSelectedProblems([]);
                }}
                className="h-6 text-xs text-destructive hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-2 space-y-1">
              {value.map((id) => {
                const p = selectedProblems.find((prob) => prob.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="flex w-full items-center justify-between p-2 rounded-md border bg-background group cursor-pointer hover:border-destructive/50"
                    onClick={() => removeProblem(id)}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-sm">
                        {p?.title || "Unknown"}
                      </span>
                    </div>
                    <X className="h-4 w-4 text-muted-foreground group-hover:text-destructive shrink-0" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
