/**
 * Turbo Engine API Adapter
 *
 * Provides an interface to the Turbo code execution engine.
 * Handles API requests, response parsing, and error handling.
 */

// ============================================
// Types - Request
// ============================================

export interface FileRequest {
  name: string;
  content: string;
  encoding?: "utf8" | "base64" | "hex";
}

export interface TurboTestCase {
  id: string;
  input: string;
  expected_output: string;
}

export interface JobRequest {
  language: string;
  version?: string;
  files: FileRequest[];
  testcases?: TurboTestCase[];
  args?: string[];
  stdin?: string;
  run_timeout?: number;
  compile_timeout?: number;
  run_memory_limit?: number;
  compile_memory_limit?: number;
}

// ============================================
// Types - Response
// ============================================

export type StageStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "OUTPUT_LIMIT_EXCEEDED";

export interface StageResult {
  status: StageStatus;
  stdout: string;
  stderr: string;
  exit_code: number;
  memory_usage: number;
  cpu_time: number;
  execution_time: number;
}

export interface TestCaseResult {
  id: string;
  passed: boolean;
  expected_output: string;
  actual_output: string;
  run_details?: {
    status: StageStatus;
    stdout: string;
    stderr: string;
    exit_code: number;
    memory_usage: number;
    cpu_time: number;
    execution_time: number;
  };
}

export interface JobResult {
  language: string;
  version: string;
  run: StageResult | null;
  compile: StageResult | null;
  testcases: TestCaseResult[];
}

export interface Runtime {
  language: string;
  version: string;
  aliases: string[];
  runtime: string;
}

// ============================================
// Adapter Configuration
// ============================================

const TURBO_API_BASE_URL =
  process.env.TURBO_API_BASE_URL || "http://localhost:4000/api/v1";

const DEFAULT_TIMEOUTS = {
  run: 5000, // 5 seconds
  compile: 10000, // 10 seconds
} as const;

const DEFAULT_MEMORY_LIMITS = {
  run: 256 * 1024 * 1024, // 256 MB
  compile: 512 * 1024 * 1024, // 512 MB
} as const;

// ============================================
// API Functions
// ============================================

/**
 * Execute code against the Turbo Engine.
 *
 * @param code - The source code to execute
 * @param language - Programming language (e.g., "java", "python")
 * @param testCases - Optional test cases for grading
 * @param stdin - Standard input (used if no test cases provided)
 * @returns JobResult with execution details
 */
export async function executeCode(
  code: string,
  language: string,
  testCases?: TurboTestCase[],
  stdin?: string,
  version?: string,
): Promise<JobResult> {
  const filename = getFilename(language);

  const request: JobRequest = {
    language,
    version,
    files: [
      {
        name: filename,
        content: code,
        encoding: "utf8",
      },
    ],
    testcases: testCases,
    stdin: testCases ? undefined : stdin,
    run_timeout: DEFAULT_TIMEOUTS.run,
    compile_timeout: DEFAULT_TIMEOUTS.compile,
    run_memory_limit: DEFAULT_MEMORY_LIMITS.run,
    compile_memory_limit: DEFAULT_MEMORY_LIMITS.compile,
  };

  const response = await fetch(`${TURBO_API_BASE_URL}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TurboError(
      `Turbo API Error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const result: JobResult = await response.json();
  return result;
}

/**
 * Get available runtimes from the Turbo Engine.
 */
export async function getRuntimes(): Promise<Runtime[]> {
  const response = await fetch(`${TURBO_API_BASE_URL}/runtimes`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new TurboError(
      `Failed to fetch runtimes: ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

export interface Package {
  name: string;
  version: string;
  installed: boolean;
}

/**
 * Get available packages from the Turbo Engine.
 * This returns installed language runtimes.
 */
export async function getPackages(): Promise<Package[]> {
  const response = await fetch(`${TURBO_API_BASE_URL}/packages`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new TurboError(
      `Failed to fetch packages: ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

// ============================================
// Error Handling
// ============================================

export class TurboError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "TurboError";
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get the appropriate filename for a given language.
 */
function getFilename(language: string): string {
  const filenameMap: Record<string, string> = {
    java: "Main.java",
    python: "main.py",
    javascript: "main.js",
    typescript: "main.ts",
    cpp: "main.cpp",
    c: "main.c",
    rust: "main.rs",
    go: "main.go",
  };

  return filenameMap[language.toLowerCase()] || `main.${language}`;
}

/**
 * Map internal test case format to Turbo API format.
 */
export function mapTestCases(
  testCases: Array<{ id: string; input: string; expectedOutput: string }>,
): TurboTestCase[] {
  return testCases.map((tc) => ({
    id: tc.id,
    input: tc.input,
    expected_output: tc.expectedOutput,
  }));
}

/**
 * Get a human-readable status message from the execution result.
 */
export function getStatusMessage(result: JobResult): string {
  // Check compilation errors first
  if (result.compile && result.compile.status !== "SUCCESS") {
    return getStageStatusMessage(result.compile.status);
  }

  // Check runtime errors
  if (result.run && result.run.status !== "SUCCESS") {
    return getStageStatusMessage(result.run.status);
  }

  // Check test case results
  if (result.testcases.length > 0) {
    const passed = result.testcases.filter((tc) => tc.passed).length;
    const total = result.testcases.length;
    if (passed === total) {
      return "All test cases passed!";
    }
    return `${passed}/${total} test cases passed`;
  }

  return "Execution completed successfully";
}

function getStageStatusMessage(status: StageStatus): string {
  const messages: Record<StageStatus, string> = {
    PENDING: "Execution pending",
    RUNNING: "Code is running...",
    SUCCESS: "Execution successful",
    RUNTIME_ERROR: "Runtime error occurred",
    COMPILATION_ERROR: "Compilation failed",
    TIME_LIMIT_EXCEEDED: "Time limit exceeded",
    MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded",
    OUTPUT_LIMIT_EXCEEDED: "Output limit exceeded",
  };

  return messages[status] || "Unknown status";
}
