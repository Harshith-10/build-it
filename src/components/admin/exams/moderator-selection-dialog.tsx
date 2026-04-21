"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getFacultyModeratorCandidates } from "@/actions/admin/exams";
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

export type FacultyCandidate = {
  id: string;
  name: string;
  email: string;
  username: string | null;
};

interface ModeratorSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (users: FacultyCandidate[]) => void;
  existingModeratorIds: string[];
  ownerId: string | null | undefined;
}

export function ModeratorSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  existingModeratorIds,
  ownerId,
}: ModeratorSelectionDialogProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [users, setUsers] = useState<FacultyCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const result = await getFacultyModeratorCandidates({
          search: debouncedSearch,
          limit: 50,
        });
        setUsers(
          result.users.filter(
            (entry) =>
              entry.id !== ownerId && !existingModeratorIds.includes(entry.id),
          ),
        );
      } catch (_error) {
        toast.error("Failed to load faculty users");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open, debouncedSearch, existingModeratorIds, ownerId]);

  const toggleSelection = (userId: string) => {
    const next = new Set(selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    const selectedUsers = users.filter((entry) => selectedIds.has(entry.id));
    onSelect(selectedUsers);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Moderators</DialogTitle>
          <DialogDescription>
            Select faculty users who can view this exam and its submissions.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or username"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 border rounded-md">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-sm">
                No faculty users found.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {users.map((entry) => {
                  const isSelected = selectedIds.has(entry.id);

                  return (
                    <button
                      type="button"
                      key={entry.id}
                      className={cn(
                        "flex w-full items-center justify-between p-3 rounded-lg border transition-colors text-left",
                        isSelected
                          ? "bg-primary/10 border-primary cursor-pointer"
                          : "hover:bg-accent cursor-pointer",
                      )}
                      onClick={() => {
                        toggleSelection(entry.id);
                      }}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate">
                          {entry.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {entry.email}
                        </span>
                        {entry.username && (
                          <span className="text-xs text-muted-foreground truncate">
                            @{entry.username}
                          </span>
                        )}
                      </div>

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
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} user{selectedIds.size !== 1 && "s"} selected
          </span>
          <div className="flex items-center gap-2">
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
