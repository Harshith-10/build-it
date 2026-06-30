import type { StrategyConfig } from "@/db/schema/exams";

export interface Exam {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  requiresPin: boolean;
  strategyType: "random_n" | "fixed_set" | "difficulty_mix" | "lab_external";
  gradingStrategy: "linear" | "difficulty_based" | "count_based" | "lab_external";
  strategyConfig: StrategyConfig | null;
  gradingConfig: unknown;
}
