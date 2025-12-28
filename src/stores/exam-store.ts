import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExamState {
  code: Record<string, string>; // questionId -> code
  setCode: (questionId: string, code: string) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      code: {},
      setCode: (questionId, code) =>
        set((state) => ({
          code: { ...state.code, [questionId]: code },
        })),
    }),
    {
      name: "exam-storage",
    },
  ),
);
