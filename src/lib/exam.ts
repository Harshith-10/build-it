export interface ExamQuestionCountSource {
  strategyType: string;
  strategyConfig: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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
