"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { awardMarks } from "../../labs";

interface MarksEditorProps {
  studentId: string;
  exerciseId: string;
  currentMarks: number | null;
  disabled?: boolean;
}

export function MarksEditor({
  studentId,
  exerciseId,
  currentMarks,
  disabled = false,
}: MarksEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    currentMarks !== null ? String(currentMarks) : "",
  );
  const [saved, setSaved] = useState(currentMarks);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const marks = parseFloat(value);
    if (Number.isNaN(marks) || marks < 0) {
      toast.error("Enter a valid marks value");
      return;
    }

    setLoading(true);
    try {
      const result = await awardMarks({ studentId, exerciseId, marks });
      if (result.success) {
        setSaved(marks);
        setEditing(false);
        toast.success("Marks saved");
      } else {
        toast.error(result.error ?? "Failed to save marks");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setValue(saved !== null ? String(saved) : "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-sm font-medium min-w-[2rem] text-center">
          {saved !== null ? saved : "—"}
        </span>
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Input
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-16 text-center text-sm px-1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-green-600 hover:text-green-700"
        onClick={handleSave}
        disabled={loading}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:text-destructive/80"
        onClick={handleCancel}
        disabled={loading}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
