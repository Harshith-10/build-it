/**
 * Jet Engine API Client
 *
 * Provides a typed interface to the Jet code execution engine.
 * Handles job submission, polling, response parsing, and error handling.
 *
 * @see API_SPEC.md for the full Jet Server API specification.
 */

import { buildJetAuthHeadersV2 } from "@/lib/jet-headers";

// ============================================
// Types - Request
// ============================================

export interface FileRequest {
  name?: string;
  content: string;
  encoding?: string;
}

export interface JetTestCase {
  id: string;
  input: string;
  expected_output?: string;
}

export interface JobRequest {
  language: string;
  version: string;
  files: FileRequest[];
  job_id?: string;
  testcases?: JetTestCase[];
  stdin?: string;
  args?: string[];
  run_timeout?: number;
  run_memory_limit?: number;
  run_output_limit?: number;
  compile_timeout?: number;
  compile_memory_limit?: number;
  compile_output_limit?: number;
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
  exit_code: number | null;
  signal: string | null;
  memory_usage: number | null;
  cpu_time: number | null;
  execution_time: number | null;
}

export interface TestCaseResult {
  id: string;
  passed: boolean;
  actual_output: string;
  run_details: StageResult;
}

export interface JobResult {
  language: string;
  version: string;
  compile: StageResult | null;
  run: StageResult | null;
  testcases: TestCaseResult[] | null;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface SubmitJobResponse {
  job_id: string;
  status: "queued";
  resolved_version: string;
}

export interface JobStateRecord {
  job_id: string;
  status: JobStatus;
  language: string;
  version: string;
  result: JobResult | null;
  error: string | null;
  queue_wait_ms?: number | null;
}

export interface RuntimeInfo {
  version: string;
  aliases: string[];
  architectures: string[];
  compiled: boolean;
}

export interface RuntimesResponse {
  total: number;
  languages: Record<string, RuntimeInfo[]>;
}

// ============================================
// Configuration
// ============================================

const JET_BASE_URL = (
  process.env.JET_SERVER_URL || "http://localhost:4000"
).replace(/\/+$/, "");

const JET_HMAC_SECRET = process.env.JET_HMAC_SECRET;
const JET_HMAC_KEY_ID = process.env.JET_HMAC_KEY_ID;

const DEFAULT_TIMEOUTS = {
  run: 5000,
  compile: 10000,
} as const;

const DEFAULT_MEMORY_LIMITS = {
  run: 256 * 1024 * 1024, // 256 MB
  compile: 512 * 1024 * 1024, // 512 MB
} as const;

const POLL_INTERVAL_MS = 250;
const MAX_POLL_ATTEMPTS = 120; // 30 seconds max

// ============================================
// Error Handling
// ============================================

export class JetError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "JetError";
  }
}

// ============================================
// Internal Helpers
// ============================================

async function submitJob(
  request: JobRequest,
  userId: string,
): Promise<SubmitJobResponse> {
  const requestBody = JSON.stringify(request);
  const rateHeaders = buildJetAuthHeadersV2({
    userId,
    keyId: getRequiredEnv(JET_HMAC_KEY_ID, "JET_HMAC_KEY_ID"),
    secret: getRequiredEnv(JET_HMAC_SECRET, "JET_HMAC_SECRET"),
    method: "POST",
    path: "/jobs",
    body: requestBody,
    contentType: "application/json",
  });

  const response = await fetch(`${JET_BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rateHeaders },
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new JetError(
      `Jet API Error (submit): ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  return response.json();
}

async function getJobResult(
  jobId: string,
  userId: string,
): Promise<JobStateRecord> {
  const rateHeaders = buildJetAuthHeadersV2({
    userId,
    keyId: getRequiredEnv(JET_HMAC_KEY_ID, "JET_HMAC_KEY_ID"),
    secret: getRequiredEnv(JET_HMAC_SECRET, "JET_HMAC_SECRET"),
    method: "GET",
    path: `/jobs/${jobId}`,
  });

  const response = await fetch(`${JET_BASE_URL}/jobs/${jobId}`, {
    method: "GET",
    headers: rateHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new JetError(
      `Jet API Error (poll): ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  return response.json();
}

async function pollUntilComplete(
  jobId: string,
  userId: string,
): Promise<JobStateRecord> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const state = await getJobResult(jobId, userId);

    if (state.status === "completed" || state.status === "failed") {
      return state;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new JetError(
    `Job ${jobId} did not complete within ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`,
  );
}

// ============================================
// Public API
// ============================================

/**
 * Execute code against the Jet Engine.
 *
 * Submits a job and polls until completion. Returns the final JobResult.
 *
 * @param userId - User ID for rate limiting headers
 * @param code - Source code to execute
 * @param language - Programming language (e.g., "java", "python")
 * @param version - Runtime version (required by Jet)
 * @param testCases - Optional test cases for batch execution
 * @param stdin - Standard input (single-run mode; ignored when testcases provided)
 */
export async function executeCode(
  userId: string,
  code: string,
  language: string,
  version: string,
  testCases?: JetTestCase[],
  stdin?: string,
): Promise<JobResult> {
  const filename = getFilename(language);

  const request: JobRequest = {
    language,
    version,
    files: [{ name: filename, content: code }],
    testcases: testCases,
    stdin: testCases ? undefined : stdin,
    run_timeout: DEFAULT_TIMEOUTS.run,
    compile_timeout: DEFAULT_TIMEOUTS.compile,
    run_memory_limit: DEFAULT_MEMORY_LIMITS.run,
    compile_memory_limit: DEFAULT_MEMORY_LIMITS.compile,
  };

  const submission = await submitJob(request, userId);
  const finalState = await pollUntilComplete(submission.job_id, userId);

  if (finalState.status === "failed") {
    throw new JetError(
      finalState.error || "Job execution failed",
      undefined,
      finalState.error || undefined,
    );
  }

  if (!finalState.result) {
    throw new JetError("Job completed but result is null");
  }

  return finalState.result;
}

/**
 * Fetch available runtimes from the Jet Engine.
 *
 * Returns a flat array of `{ language, version }` for easy consumption.
 */
export async function getRuntimes(): Promise<
  Array<{ language: string; version: string }>
> {
  const response = await fetch(`${JET_BASE_URL}/runtimes`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new JetError(
      `Failed to fetch runtimes: ${response.status}`,
      response.status,
    );
  }

  const data: RuntimesResponse = await response.json();

  // Flatten the grouped response into a simple array
  const runtimes: Array<{ language: string; version: string }> = [];
  for (const [language, versions] of Object.entries(data.languages)) {
    for (const runtime of versions) {
      runtimes.push({ language, version: runtime.version });
    }
  }

  return runtimes;
}

/**
 * Check if the Jet server is healthy.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const healthUrl = `${JET_BASE_URL}/health`;
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================
// Utility Functions
// ============================================

const FILENAME_MAP: Record<string, string> = {
  java: "Main.java",
  python: "main.py",
  javascript: "main.js",
  typescript: "main.ts",
  cpp: "main.cpp",
  c: "main.c",
  rust: "main.rs",
  go: "main.go",
};

function getFilename(language: string): string {
  return FILENAME_MAP[language.toLowerCase()] || `main.${language}`;
}

function getRequiredEnv(value: string | undefined, name: string): string {
  if (value) {
    return value;
  }
  throw new JetError(`${name} is required for Jet V2 authentication`);
}

/**
 * Map internal test case format to Jet API format.
 */
export function mapTestCases(
  testCases: Array<{ id: string; input: string; expectedOutput: string }>,
): JetTestCase[] {
  return testCases.map((tc) => ({
    id: tc.id,
    input: tc.input,
    expected_output: tc.expectedOutput,
  }));
}

/**
 * Get a human-readable status message from an execution result.
 */
export function getStatusMessage(result: JobResult): string {
  if (result.compile && result.compile.status !== "SUCCESS") {
    return getStageStatusMessage(result.compile.status);
  }

  if (result.run && result.run.status !== "SUCCESS") {
    return getStageStatusMessage(result.run.status);
  }

  if (result.testcases && result.testcases.length > 0) {
    const passed = result.testcases.filter((tc) => tc.passed).length;
    const total = result.testcases.length;
    return passed === total
      ? "All test cases passed!"
      : `${passed}/${total} test cases passed`;
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
