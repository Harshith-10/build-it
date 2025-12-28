export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: string;
  title: string;
  problemStatement: string;
  testCases: TestCase[];
}

export interface TestcaseResult {
  id: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  run_details: {
    stdout: string;
    stderr: string;
  };
}
