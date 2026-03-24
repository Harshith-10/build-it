export interface GeneratedProblemTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface GeneratedProblemDraft {
  title: string;
  difficulty: "easy" | "medium" | "hard";
  problemStatement: string;
  allowedLanguages: string[];
  driverCodeMap: Record<string, string>;
  testCases: GeneratedProblemTestCase[];
}
