import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExamState {
  code: Record<string, Record<string, string>>; // questionId -> language -> code
  setCode: (questionId: string, language: string, code: string) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "exam-storage-v2", // Bump version to avoid conflicts
    },
  ),
);
