"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  runCode,
  runWithCustomInput,
} from "@/actions/student/exams/code-actions";
import { submitQuestion } from "@/actions/student/exams/submit-actions";
import type { TestcaseResult } from "@/types/problem";

interface UseCodeExecutionProps {
  assignmentId?: string;
  questionId?: string;
  code: string;
  language: string;
  version?: string;
  testCases: Array<{ id: string; input: string; expectedOutput: string }>;
}

export function useCodeExecution() {
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
    assignmentId,
    code,
    language,
    version,
    testCases,
  }: Omit<UseCodeExecutionProps, "questionId">) => {
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
        const result = await runWithCustomInput({
          assignmentId,
          code,
          language,
          version,
          stdin: customInput,
        });

        if (result.compilationError) {
          setConsoleOutput({
            stdout: "",
            stderr: `Compilation Error:\n${result.compilationError}`,
          });
          toast.error("Compilation failed");
        } else if (!result.success) {
          setConsoleOutput({
            stdout: "",
            stderr: result.error || "Execution failed",
          });
          toast.error(result.error || "Execution failed");
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
        const result = await runCode({
          assignmentId,
          code,
          language,
          version,
          testCases,
        });

        if (result.compilationError) {
          setActiveTab("custom");
          setConsoleOutput({
            stdout: "",
            stderr: `Compilation Error:\n${result.compilationError}`,
          });
          toast.error("Compilation failed");
        } else if (!result.success) {
          setActiveTab("custom");
          setConsoleOutput({
            stdout: "",
            stderr: result.error || "Execution failed",
          });
          toast.error(result.error || "Execution failed");
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
    assignmentId,
    questionId,
    code,
    language,
    version,
  }: Omit<UseCodeExecutionProps, "testCases">) => {
    if (!assignmentId || !questionId) {
      toast.error("Missing assignment or question parameters");
      return;
    }
    if (!version) {
      toast.error(`No ${language} runtime available.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitQuestion({
        assignmentId,
        questionId,
        code,
        language,
        version,
      });

      if (!result.success) {
        toast.error(result.error || "Submission failed");
        if (result.verdict === "compile_error" && result.details) {
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
          description: `You passed all hidden test cases. Score updated to ${result.score}.`,
        });
      } else if (result.verdict === "failed") {
        toast.warning("Submission Recorded", {
          description: `Code saved, but only ${result.testCasesPassed}/${result.totalTestCases} hidden test cases passed.`,
        });
      } else if (result.verdict === "compile_error") {
        toast.error("Compilation Error", {
          description: "Your code failed to compile on submission.",
        });
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Submission Compilation Error:\n${result.details}`,
        });
      } else if (result.verdict === "runtime_error") {
        toast.error("Runtime Error", {
          description:
            "Your code encountered a runtime error during submission.",
        });
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Submission Runtime Error:\n${result.details}`,
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
