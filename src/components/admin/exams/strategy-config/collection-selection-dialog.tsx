"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCollections } from "@/actions/admin/collections";
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

interface Collection {
  id: string;
  title: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (collections: Collection[]) => void;
  selectedCollectionIds: string[];
}

export function CollectionSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  selectedCollectionIds,
}: CollectionSelectionDialogProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [collections, setCollections] = useState<Collection[]>([]);
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
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const res = await getCollections({
          limit: 50, // Fetch more for selection
          search: debouncedSearch,
        });
        setCollections(res.collections as unknown as Collection[]);
      } catch (_error) {
        toast.error("Failed to load collections");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchCollections();
    }
  }, [open, debouncedSearch]);

  const toggleSelection = (collectionId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    const selectedCollections = collections.filter((c) =>
      selectedIds.has(c.id),
    );
    onSelect(selectedCollections);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Collections</DialogTitle>
          <DialogDescription>
            Search and select collections to pull questions from.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
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
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <p>No collections found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {collections.map((collection) => {
                  const isAlreadySelected = selectedCollectionIds.includes(
                    collection.id,
                  );
                  const isSelected = selectedIds.has(collection.id);

                  return (
                    <button
                      type="button"
                      key={collection.id}
                      className={cn(
                        "flex w-full items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer text-left",
                        isAlreadySelected
                          ? "bg-muted opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-accent",
                      )}
                      onClick={() => {
                        if (!isAlreadySelected) {
                          toggleSelection(collection.id);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {collection.title}
                        </span>
                        {collection.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {collection.description}
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
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} collection{selectedIds.size !== 1 && "s"}{" "}
            selected
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
