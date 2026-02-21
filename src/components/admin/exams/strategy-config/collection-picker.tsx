"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCollections } from "@/actions/admin/collections";
import { CollectionSelectionDialog } from "@/components/admin/exams/strategy-config/collection-selection-dialog";
import { Button } from "@/components/ui/button";

interface CollectionPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function CollectionPicker({ value, onChange }: CollectionPickerProps) {
  const [openDialog, setOpenDialog] = useState(false);
  // biome-ignore lint/suspicious/noExplicitAny: complex component state type
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);

  useEffect(() => {
    async function loadSelectedCollections() {
      if (!value || value.length === 0) {
        setSelectedCollections([]);
        return;
      }
      try {
        const { collections } = await getCollections({ limit: 100 });
        setSelectedCollections(collections.filter((c) => value.includes(c.id)));
      } catch (error) {
        console.error("Failed to load collections", error);
      }
    }
    loadSelectedCollections();
  }, [value]);

  // biome-ignore lint/suspicious/noExplicitAny: complex hook type
  const handleSelectCollections = (newCollections: any[]) => {
    const combined = [...selectedCollections, ...newCollections];
    // Remove duplicates
    const unique = Array.from(
      new Map(combined.map((item) => [item.id, item])).values(),
    );
    setSelectedCollections(unique);
    onChange(unique.map((c) => c.id));
  };

  const removeCollection = (id: string) => {
    setSelectedCollections((prev) => prev.filter((c) => c.id !== id));
    onChange(value.filter((v) => v !== id));
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {selectedCollections.length > 0 && (
          <div className="flex flex-col gap-2 border rounded-md p-2 bg-muted/20 overflow-y-auto max-h-[140px] scrollbar-thin">
            {selectedCollections.map((c) => (
              <div
                key={c.id}
                className="flex w-full items-center justify-between p-2 rounded-md border bg-background group"
              >
                <span className="font-medium text-sm">{c.title}</span>
                <button
                  type="button"
                  onClick={() => removeCollection(c.id)}
                  className="rounded-full p-1 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpenDialog(true)}
          className="w-full justify-start items-center gap-2 border-dashed h-10"
        >
          <Plus className="h-4 w-4" />
          {selectedCollections.length > 0
            ? "Add more collections..."
            : "Select collections..."}
        </Button>
      </div>

      <CollectionSelectionDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onSelect={handleSelectCollections}
        selectedCollectionIds={value || []}
      />
    </>
  );
}
