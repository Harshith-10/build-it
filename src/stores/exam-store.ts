import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExamState {
  assignmentId: string | null; // tracks which attempt the stored code belongs to
  code: Record<string, Record<string, string>>; // questionId -> language -> code
  setCode: (questionId: string, language: string, code: string) => void;
  initForExam: (assignmentId: string) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      assignmentId: null,
      code: {},
      setCode: (questionId, language, code) =>
        set((state) => ({
          code: {
            ...state.code,
            [questionId]: {
              ...(state.code[questionId] || {}),
              [language]: code,
            },
          },
        })),
      initForExam: (assignmentId) => {
        const current = get().assignmentId;
        if (current !== assignmentId) {
          // Different attempt — clear stale code and set new assignment ID
          set({ assignmentId, code: {} });
        }
        // Same attempt — do nothing, preserve existing code
      },
    }),
    {
      name: "exam-storage-v3", // Bumped from v2 to avoid loading stale unscoped data
    },
  ),
);
