import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExamState {
  code: Record<string, Record<string, Record<string, string>>>; // examId -> questionId -> language -> code
  setCode: (examId: string, questionId: string, language: string, code: string) => void;
  clearExamCode: (examId: string) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      code: {},

      setCode: (examId, questionId, language, code) =>
        set((state) => ({
          code: {
            ...state.code,
            [examId]: {
              ...(state.code[examId] || {}),
              [questionId]: {
                ...(state.code[examId]?.[questionId] || {}),
                [language]: code,
              },
            },
          },
        })),

      clearExamCode: (examId) =>
        set((state) => {
          const updated = { ...state.code };
          delete updated[examId];
          return { code: updated };
        }),
    }),
    {
      name: "exam-storage-v3", // bumped to wipe old v2 data
    },
  ),
);