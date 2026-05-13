export interface ExamQuestionCountSource {
  strategyType: string;
  strategyConfig: unknown;
}

export const EXAM_SUBMISSION_GRACE_MS = 5 * 60 * 1000;

export type ExamTimingPhase = "before_deadline" | "grace_window" | "expired";

export interface ExamTimingSnapshot {
  serverNowMs: number;
  startedAtMs: number;
  deadlineMs: number;
  graceDeadlineMs: number;
  remainingMs: number;
  graceRemainingMs: number;
  phase: ExamTimingPhase;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function buildExamTimingSnapshot({
  startedAt,
  durationMinutes,
  now = new Date(),
  graceMs = EXAM_SUBMISSION_GRACE_MS,
}: {
  startedAt: Date | string | number | null | undefined;
  durationMinutes: number;
  now?: Date;
  graceMs?: number;
}): ExamTimingSnapshot | null {
  if (!startedAt) return null;

  const startedAtMs = asDate(startedAt).getTime();
  const safeDurationMinutes = Math.max(0, durationMinutes);
  const deadlineMs = startedAtMs + safeDurationMinutes * 60 * 1000;
  const graceDeadlineMs = deadlineMs + Math.max(0, graceMs);
  const serverNowMs = now.getTime();
  const remainingMs = deadlineMs - serverNowMs;
  const graceRemainingMs = graceDeadlineMs - serverNowMs;

  const phase: ExamTimingPhase =
    remainingMs > 0
      ? "before_deadline"
      : graceRemainingMs >= 0
        ? "grace_window"
        : "expired";

  return {
    serverNowMs,
    startedAtMs,
    deadlineMs,
    graceDeadlineMs,
    remainingMs,
    graceRemainingMs,
    phase,
  };
}

export function getExamQuestionCount(exam: ExamQuestionCountSource): number {
  const config = asRecord(exam.strategyConfig);

  if (!config) {
    return 0;
  }

  if (exam.strategyType === "random_n") {
    return typeof config.count === "number" ? config.count : 0;
  }

  if (exam.strategyType === "difficulty_mix") {
    return ([config.easy, config.medium, config.hard] as const).reduce<number>(
      (sum, value) => sum + (typeof value === "number" ? value : 0),
      0,
    );
  }

  if (exam.strategyType === "fixed_set") {
    return Array.isArray(config.questionIds) ? config.questionIds.length : 0;
  }

  return 0;
}
