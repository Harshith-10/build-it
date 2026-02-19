"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getGroups } from "@/actions/admin/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (groups: Group[]) => void;
  selectedGroupIds: string[];
}

export function GroupSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  selectedGroupIds,
}: GroupSelectionDialogProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const res = await getGroups({
          limit: 50, // Fetch more for selection
          search: debouncedSearch,
        });
        setGroups(res.groups);
      } catch (_error) {
        toast.error("Failed to load groups");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchGroups();
    }
  }, [open, debouncedSearch]);

  const toggleSelection = (groupId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    const selectedGroups = groups.filter((g) => selectedIds.has(g.id));
    onSelect(selectedGroups);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Groups</DialogTitle>
          <DialogDescription>
            Search and select groups to assign to this exam.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 border rounded-md relative">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <p>No groups found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {groups.map((group) => {
                  const isAlreadySelected = selectedGroupIds.includes(group.id);
                  const isSelected = selectedIds.has(group.id);

                  return (
                    <div
                      key={group.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                        isAlreadySelected
                          ? "bg-muted opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-accent",
                      )}
                      onClick={() => {
                        if (!isAlreadySelected) {
                          toggleSelection(group.id);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {group.name}
                        </span>
                        {group.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {group.description}
                          </span>
                        )}
                      </div>
                      {isAlreadySelected ? (
                        <Badge variant="secondary" className="text-xs">
                          Added
                        </Badge>
                      ) : (
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border flex items-center justify-center",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} group{selectedIds.size !== 1 && "s"} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Add Selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
