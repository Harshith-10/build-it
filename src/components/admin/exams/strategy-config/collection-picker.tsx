"use client";

import { useEffect, useState } from "react";
import { getCollections } from "@/actions/admin/collections";
import { MultiSelect, type Option } from "@/components/ui/multi-select";

interface CollectionPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function CollectionPicker({ value, onChange }: CollectionPickerProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCollections() {
      try {
        const { collections } = await getCollections({ limit: 100 });
        setOptions(
          collections.map((c) => ({
            label: c.title,
            value: c.id,
          })),
        );
      } catch (error) {
        console.error("Failed to load collections", error);
      } finally {
        setLoading(false);
      }
    }
    loadCollections();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading collections...
      </div>
    );
  }

  return (
    <MultiSelect
      options={options}
      selected={value || []}
      onChange={onChange}
      placeholder="Select collections..."
      className="w-full"
    />
  );
}
