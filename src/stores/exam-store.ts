import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExamState {
  userId: string | null; // tracks which user the stored code belongs to
  assignmentId: string | null; // tracks which attempt the stored code belongs to
  code: Record<string, Record<string, string>>; // questionId -> language -> code
  setCode: (
    userId: string,
    assignmentId: string,
    questionId: string,
    language: string,
    code: string,
  ) => void;
  initForExam: (userId: string, assignmentId: string) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      userId: null,
      assignmentId: null,
      code: {},
      setCode: (targetUserId, targetAssignmentId, questionId, language, code) =>
        set((state) => {
          const isSameSession =
            state.userId === targetUserId &&
            state.assignmentId === targetAssignmentId;
          const currentCodeMap = isSameSession ? state.code : {};

          return {
            userId: targetUserId,
            assignmentId: targetAssignmentId,
            code: {
              ...currentCodeMap,
              [questionId]: {
                ...(currentCodeMap[questionId] || {}),
                [language]: code,
              },
            },
          };
        }),
      initForExam: (targetUserId, targetAssignmentId) => {
        const { userId: currentUserId, assignmentId: currentAssignmentId } = get();
        if (
          currentUserId !== targetUserId ||
          currentAssignmentId !== targetAssignmentId
        ) {
          // Different user or attempt — clear stale code and update session IDs
          set({ userId: targetUserId, assignmentId: targetAssignmentId, code: {} });
        }
        // Same user and attempt — preserve existing code
      },
    }),
    {
      name: "exam-storage-v4", // Bumped to v4 to enforce user-scoped storage isolation
    },
  ),
);
