export type GradingStrategy = "linear" | "difficulty_based" | "count_based";
export type Difficulty = "easy" | "medium" | "hard";

export interface GradingInput {
  strategy: GradingStrategy | string;
  config: any;
  passedQuestionIds: string[];
  questionDifficulties?: Record<string, Difficulty>;
}

export function calculateGradingScore(input: GradingInput): number {
  const { strategy, config, passedQuestionIds, questionDifficulties } = input;
  let score = 0;

  if (strategy === "linear") {
    // Linear: Score = (Number of passed questions) * (Marks per question)
    const marksPerQuestion = config?.marks || 0;
    score = passedQuestionIds.length * marksPerQuestion;
  } else if (strategy === "difficulty_based") {
    // Difficulty Based: Sum of marks of passed questions based on their difficulty
    const difficultyMarks = {
      easy: config?.easy || 0,
      medium: config?.medium || 0,
      hard: config?.hard || 0,
    };

    for (const qId of passedQuestionIds) {
      const difficulty = questionDifficulties?.[qId];
      if (difficulty) {
        score += difficultyMarks[difficulty] || 0;
      }
    }
  } else if (strategy === "count_based") {
    // Count Based: Threshold system
    const rules = (config?.rules || []) as {
      count: number;
      marks: number;
    }[];
    // Sort rules by count descending to find the highest threshold met
    rules.sort((a, b) => b.count - a.count);

    const passedCount = passedQuestionIds.length;
    const matchedRule = rules.find((r) => passedCount >= r.count);
    if (matchedRule) {
      score = matchedRule.marks;
    }
  } else {
    // Legacy or unknown
    console.warn(`Unknown grading strategy: ${strategy}`);
    score = 0;
  }

  return score;
}
