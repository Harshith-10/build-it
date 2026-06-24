"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  runCode365,
  runCode365CustomInput,
  submitCode365Solution,
} from "@/actions/student/exams/code365-actions";
import type { TestcaseResult } from "@/types/problem";

interface UseCode365ExecutionProps {
  problemId: string;
  code: string;
  language: string;
  version?: string;
  testCases: Array<{ id: string; input: string; expectedOutput: string }>;
}

export function useCode365Execution() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("test-cases");
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<TestcaseResult[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout: string;
    stderr: string;
  } | null>(null);

  // Rate Limiting
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleRun = async ({
    code,
    language,
    version,
    testCases,
  }: Omit<UseCode365ExecutionProps, "problemId">) => {
    if (!version) {
      toast.error(`No ${language} runtime available.`);
      return;
    }
    if (cooldown > 0) return;

    setCooldown(5);
    setIsRunning(true);
    setResults([]);
    setConsoleOutput(null);

    try {
      if (activeTab === "custom") {
        const result = await runCode365CustomInput({
          code,
          language,
          version,
          stdin: customInput,
        });

        if (!result.success) {
          if ('compilationError' in result && result.compilationError) {
            setConsoleOutput({
              stdout: "",
              stderr: `Compilation Error:\n${result.compilationError}`,
            });
            toast.error("Compilation failed");
          } else {
            setConsoleOutput({
              stdout: "",
              stderr: result.error || "Execution failed",
            });
            toast.error(result.error || "Execution failed");
          }
        } else {
          setConsoleOutput({
            stdout: result.stdout || "",
            stderr: result.stderr || "",
          });
          if (result.stderr) {
            toast.warning("Executed with errors");
          } else {
            toast.success(`Executed in ${result.executionTime}ms`);
          }
        }
      } else {
        setActiveTab("results");
        const result = await runCode365({
          code,
          language,
          version,
          visibleTestCases: testCases,
        });

        if (!result.success) {
          setActiveTab("custom");
          if ('compilationError' in result && result.compilationError) {
            setConsoleOutput({
              stdout: "",
              stderr: `Compilation Error:\n${result.compilationError}`,
            });
            toast.error("Compilation failed");
          } else {
            setConsoleOutput({
              stdout: "",
              stderr: result.error || "Execution failed",
            });
            toast.error(result.error || "Execution failed");
          }
        } else if (result.results) {
          setResults(result.results);
          const passed = result.results.filter((r) => r.passed).length;
          const total = result.results.length;
          if (passed === total) {
            toast.success(`All ${total} test cases passed!`);
          } else {
            toast.warning(`${passed}/${total} test cases passed`);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to run code");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async ({
    problemId,
    code,
    language,
    version,
  }: Omit<UseCode365ExecutionProps, "testCases">) => {
    if (!version) {
      toast.error(`No ${language} runtime available.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitCode365Solution({
        problemId,
        code,
        language,
        version,
      });

      if (!result.success) {
        toast.error(result.error || "Submission failed");
        if ('verdict' in result && result.verdict === "compile_error" && 'details' in result) {
          setActiveTab("custom");
          setConsoleOutput({
            stdout: "",
            stderr: `Submission Compilation Error:\n${result.details}`,
          });
        }
        return;
      }

      if (result.verdict === "passed") {
        toast.success("Correct Answer!", {
          description: `You passed all test cases!`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isRunning,
    isSubmitting,
    activeTab,
    setActiveTab,
    customInput,
    setCustomInput,
    results,
    consoleOutput,
    cooldown,
    handleRun,
    handleSubmit,
  };
}
