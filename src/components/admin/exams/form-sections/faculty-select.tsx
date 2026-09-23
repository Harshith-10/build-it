"use client";

import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FacultyOption } from "./assignments-list";

interface FacultySelectProps {
  availableFaculty: FacultyOption[];
  selectedFacultyId?: string;
  onSelect: (facultyId: string | null) => void;
  assignedElsewhereMap: Map<string, string>;
  placeholder?: string;
}

export function FacultySelect({
  availableFaculty,
  selectedFacultyId,
  onSelect,
  assignedElsewhereMap,
  placeholder = "Select faculty...",
}: FacultySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedFaculty = availableFaculty.find((f) => f.id === selectedFacultyId);

  const filteredFaculty = availableFaculty.filter((f) => {
    const term = search.toLowerCase();
    const nameMatch = f.name?.toLowerCase().includes(term);
    const emailMatch = f.email.toLowerCase().includes(term);
    const userMatch = f.username?.toLowerCase().includes(term);
    return nameMatch || emailMatch || userMatch;
  });

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          type="button"
          aria-expanded={open}
          className="w-full justify-between h-9 px-3 hover:bg-background text-left font-normal overflow-hidden"
        >
          {selectedFaculty ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs font-medium text-foreground">
                {selectedFaculty.name || selectedFaculty.email}
              </span>
              {selectedFaculty.name && (
                <span className="truncate text-[11px] text-muted-foreground">
                  ({selectedFaculty.email})
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground font-normal text-xs">
              {placeholder}
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedFaculty && (
              <span
                role="button"
                tabIndex={0}
                className="rounded hover:bg-muted p-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(null);
                  }
                }}
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[320px] p-2 shadow-md rounded-lg"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <ScrollArea className="max-h-56">
          <div className="space-y-1 pr-2">
            {/* Unassign option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center w-full px-2.5 py-1.5 rounded-md text-xs text-left gap-2 cursor-pointer transition-colors hover:bg-muted",
                !selectedFacultyId
                  ? "text-primary font-medium bg-primary/5"
                  : "text-muted-foreground",
              )}
            >
              <div className="h-4 w-4 flex items-center justify-center shrink-0">
                {!selectedFacultyId && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <span className="italic">None (Unassigned)</span>
            </button>

            {filteredFaculty.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No faculty found.
              </p>
            ) : (
              filteredFaculty.map((f) => {
                const isCurrent = f.id === selectedFacultyId;
                const assignedSection = assignedElsewhereMap.get(f.id);
                const isAssignedElsewhere = Boolean(assignedSection);

                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={isAssignedElsewhere}
                    onClick={() => {
                      if (!isAssignedElsewhere) {
                        handleSelect(f.id);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs text-left gap-2 transition-colors",
                      isCurrent && "bg-primary/10 text-primary font-medium",
                      isAssignedElsewhere
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : "cursor-pointer hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-4 w-4 flex items-center justify-center shrink-0">
                        {isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate font-medium text-xs">
                          {f.name || f.username || f.email}
                        </span>
                        {f.name && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {f.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {isAssignedElsewhere && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-muted-foreground shrink-0 border-muted"
                      >
                        {assignedSection}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
