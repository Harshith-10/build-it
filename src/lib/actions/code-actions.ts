"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  executeCode,
  getPackages,
  type JobResult,
  mapTestCases,
  TurboError,
  type TurboTestCase,
} from "@/lib/turbo";
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
  // Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    const turboTestCases: TurboTestCase[] = mapTestCases(input.testCases);

    const result: JobResult = await executeCode(
      input.code,
      input.language,
      turboTestCases,
      undefined,
      input.version,
    );

    // Check for compilation errors
    if (result.compile && result.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        compilationError: result.compile.stderr || "Compilation failed",
      };
    }

    // Map Turbo results to our TestcaseResult format
    const testResults: TestcaseResult[] = result.testcases.map((tc, index) => ({
      id: tc.id,
      passed: tc.passed,
      input: input.testCases[index]?.input || "",
      expectedOutput: tc.expected_output,
      actualOutput: tc.actual_output,
      run_details: {
        // Use per-testcase run_details if available, fallback to global run
        stdout: tc.run_details?.stdout || result.run?.stdout || "",
        stderr: tc.run_details?.stderr || result.run?.stderr || "",
      },
    }));

    return {
      success: true,
      results: testResults,
      executionTime: result.run?.execution_time,
    };
  } catch (error) {
    console.error("Code execution error:", error);

    if (error instanceof TurboError) {
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
  // Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    const result: JobResult = await executeCode(
      input.code,
      input.language,
      undefined, // No test cases
      input.stdin,
      input.version,
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
        success: true, // Still return output even with runtime errors
        stdout: result.run.stdout,
        stderr: result.run.stderr,
        executionTime: result.run.execution_time,
      };
    }

    return {
      success: true,
      stdout: result.run?.stdout || "",
      stderr: result.run?.stderr || "",
      executionTime: result.run?.execution_time,
    };
  } catch (error) {
    console.error("Custom input execution error:", error);

    if (error instanceof TurboError) {
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
 * Fetch available Java runtimes from the Turbo Engine.
 * Uses the /packages endpoint to get installed language runtimes.
 */
export async function getJavaRuntimes(): Promise<{
  success: boolean;
  runtimes?: Array<{ name: string; version: string }>;
  error?: string;
}> {
  try {
    const allPackages = await getPackages();
    // Filter for installed Java packages only
    const javaPackages = allPackages.filter(
      (pkg) => pkg.name.toLowerCase() === "java" && pkg.installed,
    );

    return {
      success: true,
      runtimes: javaPackages.map((pkg) => ({
        name: pkg.name,
        version: pkg.version,
      })),
    };
  } catch (error) {
    console.error("Failed to fetch runtimes:", error);

    if (error instanceof TurboError) {
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
