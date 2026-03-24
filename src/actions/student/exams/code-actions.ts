"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  checkHealth,
  executeCode,
  getRuntimes as getJetRuntimes,
  JetError,
  type JetTestCase,
  type JobResult,
  mapTestCases,
} from "@/lib/jet";
import { sortRuntimes } from "@/lib/runtime-utils";
import type { TestcaseResult } from "@/types/problem";

// ============================================
// Types
// ============================================

export interface RunCodeInput {
  code: string;
  language: string;
  version?: string;
  testCases: Array<{ id: string; input: string; expectedOutput: string }>;
}

export interface RunCodeResult {
  success: boolean;
  results?: TestcaseResult[];
  error?: string;
  compilationError?: string;
  executionTime?: number;
}

export interface RunCustomInput {
  code: string;
  language: string;
  version?: string;
  stdin: string;
}

export interface RunCustomResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  compilationError?: string;
  executionTime?: number;
}

// ============================================
// Server Actions
// ============================================

/**
 * Run code against provided test cases.
 * Used for the "Run" button to test against visible test cases.
 */
export async function runCode(input: RunCodeInput): Promise<RunCodeResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  if (!input.version) {
    return { success: false, error: "Runtime version is required" };
  }

  try {
    const jetTestCases: JetTestCase[] = mapTestCases(input.testCases);

    const result: JobResult = await executeCode(
      session.user.id,
      input.code,
      input.language,
      input.version,
      jetTestCases,
    );

    // Check for compilation errors
    if (result.compile && result.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        compilationError: result.compile.stderr || "Compilation failed",
      };
    }

    // Map Jet results to our TestcaseResult format
    const testResults: TestcaseResult[] = (result.testcases ?? []).map(
      (tc, index) => ({
        id: tc.id,
        passed: tc.passed,
        input: input.testCases[index]?.input || "",
        expectedOutput: input.testCases[index]?.expectedOutput || "",
        actualOutput: tc.actual_output,
        run_details: {
          stdout: tc.run_details?.stdout || "",
          stderr: tc.run_details?.stderr || "",
        },
      }),
    );

    return {
      success: true,
      results: testResults,
      executionTime: result.run?.execution_time ?? undefined,
    };
  } catch (error) {
    console.error("Code execution error:", error);

    if (error instanceof JetError) {
      return {
        success: false,
        error: `Execution service error: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute code",
    };
  }
}

/**
 * Run code with custom stdin input.
 * Used for the "Custom Input" tab to test with user-provided input.
 */
export async function runWithCustomInput(
  input: RunCustomInput,
): Promise<RunCustomResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  if (!input.version) {
    return { success: false, error: "Runtime version is required" };
  }

  try {
    const result: JobResult = await executeCode(
      session.user.id,
      input.code,
      input.language,
      input.version,
      undefined,
      input.stdin,
    );

    // Check for compilation errors
    if (result.compile && result.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        compilationError: result.compile.stderr || "Compilation failed",
      };
    }

    // Check for runtime errors
    if (result.run && result.run.status !== "SUCCESS") {
      return {
        success: true,
        stdout: result.run.stdout,
        stderr: result.run.stderr,
        executionTime: result.run.execution_time ?? undefined,
      };
    }

    return {
      success: true,
      stdout: result.run?.stdout || "",
      stderr: result.run?.stderr || "",
      executionTime: result.run?.execution_time ?? undefined,
    };
  } catch (error) {
    console.error("Custom input execution error:", error);

    if (error instanceof JetError) {
      return {
        success: false,
        error: `Execution service error: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute code",
    };
  }
}

/**
 * Fetch available language runtimes from the Jet Engine.
 */
export async function getRuntimes(): Promise<{
  success: boolean;
  runtimes?: Array<{ language: string; version: string }>;
  error?: string;
}> {
  try {
    const runtimes = await getJetRuntimes();
    return { success: true, runtimes: sortRuntimes(runtimes) };
  } catch (error) {
    console.error("Failed to fetch runtimes:", error);

    if (error instanceof JetError) {
      return {
        success: false,
        error: `Failed to connect to execution service: ${error.message}`,
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch runtimes",
    };
  }
}

/**
 * Check if the Jet server is online via health endpoint.
 */
export async function checkJetHealth(): Promise<{ success: boolean }> {
  const isHealthy = await checkHealth();
  return { success: isHealthy };
}
