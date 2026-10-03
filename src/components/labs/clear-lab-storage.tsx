"use client";

import { useEffect } from "react";

export function ClearLabStorage({ exerciseId }: { exerciseId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith(`lab_code_${exerciseId}_`) ||
            key.startsWith(`lab_lang_${exerciseId}_`))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error("Failed to clear lab localStorage cache:", e);
    }
  }, [exerciseId]);

  return null;
}
