"use client";

import { java } from "@codemirror/lang-java";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDown, Loader2, Play, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  getJavaRuntimes,
  runCode,
  runWithCustomInput,
} from "@/lib/actions/code-actions";
import { useExamStore } from "@/stores/exam-store";
import type { TestcaseResult } from "@/types/problem";
import { ThemeToggle } from "../theme-toggle";
import { ButtonGroup } from "../ui/button-group";
import type { Question } from "./ide-shell";
import TestCaseConsole from "./test-case-console";

interface JavaRuntime {
  name: string;
  version: string;
}

interface CodePlaygroundProps {
  question: Question;
  assignmentId: string;
}

export function CodePlayground({
  question,
  assignmentId,
}: CodePlaygroundProps) {
  const { code, setCode } = useExamStore();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // Runtime State
  const [runtimes, setRuntimes] = useState<JavaRuntime[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();
  const [runtimeLoading, setRuntimeLoading] = useState(true);

  // Console State
  const [activeTab, setActiveTab] = useState("test-cases");
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<TestcaseResult[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout: string;
    stderr: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate Limiting
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Java runtimes on mount
  useEffect(() => {
    async function fetchRuntimes() {
      const result = await getJavaRuntimes();
      setRuntimeLoading(false);

      if (result.success && result.runtimes) {
        setRuntimes(result.runtimes);
        // Auto-select the first runtime
        if (result.runtimes.length > 0) {
          setSelectedVersion(result.runtimes[0].version);
        }
      } else {
        toast.error(result.error || "Failed to load Java runtimes");
      }
    }

    fetchRuntimes();
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading Editor...
      </div>
    );
  }

  const defaultCode = `// Write your Java code for ${question.title} here\n\nclass Main {\n  public static void main(String[] args) {\n    // Your code here\n  }\n}`;
  const currentCode = question.id in code ? code[question.id] : defaultCode;

  const handleRun = async () => {
    if (!selectedVersion) {
      toast.error("No Java runtime available. Check Turbo server.");
      return;
    }

    if (cooldown > 0) return;

    // Start cooldown
    setCooldown(5);

    setIsRunning(true);
    setResults([]); // Clear previous results
    setConsoleOutput(null);

    // Determine if running test cases or custom input
    if (activeTab === "custom") {
      // Run with custom input
      const result = await runWithCustomInput({
        code: currentCode,
        language: "java",
        version: selectedVersion,
        stdin: customInput,
      });

      setIsRunning(false);

      if (result.compilationError) {
        setConsoleOutput({
          stdout: "",
          stderr: `Compilation Error:\n${result.compilationError}`,
        });
        toast.error("Compilation failed");
        return;
      }

      if (!result.success) {
        setConsoleOutput({
          stdout: "",
          stderr: result.error || "Execution failed",
        });
        toast.error(result.error || "Execution failed");
        return;
      }

      setConsoleOutput({
        stdout: result.stdout || "",
        stderr: result.stderr || "",
      });

      if (result.stderr) {
        toast.warning("Executed with errors");
      } else {
        toast.success(`Executed in ${result.executionTime}ms`);
      }
    } else {
      // Run against test cases
      setActiveTab("results");

      const result = await runCode({
        code: currentCode,
        language: "java",
        version: selectedVersion,
        testCases: question.testCases,
      });

      setIsRunning(false);

      if (result.compilationError) {
        // Switch to custom tab to show compilation error in output area
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Compilation Error:\n${result.compilationError}`,
        });
        toast.error("Compilation failed");
        return;
      }

      if (!result.success) {
        // Switch to custom tab to show execution error
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: result.error || "Execution failed",
        });
        toast.error(result.error || "Execution failed");
        return;
      }

      if (result.results) {
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
  };

  const handleSubmit = async () => {
    if (!selectedVersion) {
      toast.error("No Java runtime available.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Dynamically import to avoid circular dependency issues if any
      const { submitQuestion } = await import("@/lib/actions/submit-actions");

      const result = await submitQuestion({
        assignmentId,
        questionId: question.id,
        code: currentCode,
        language: "java",
        version: selectedVersion,
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

      // Handle Success Verdicts
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

  return (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Main.java</span>
              {/* Runtime Version Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    disabled={runtimeLoading || runtimes.length === 0}
                  >
                    {runtimeLoading
                      ? "Loading..."
                      : selectedVersion
                        ? `Java ${selectedVersion}`
                        : "No Java Runtime"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {runtimes.map((runtime) => (
                    <DropdownMenuItem
                      key={runtime.version}
                      onClick={() => setSelectedVersion(runtime.version)}
                      className={
                        selectedVersion === runtime.version
                          ? "bg-accent"
                          : undefined
                      }
                    >
                      Java {runtime.version}
                    </DropdownMenuItem>
                  ))}
                  {runtimes.length === 0 && !runtimeLoading && (
                    <DropdownMenuItem disabled>
                      No runtimes available
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRun}
                  disabled={isRunning || !selectedVersion || cooldown > 0}
                  className="gap-1.5"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {isRunning
                    ? "Running..."
                    : cooldown > 0
                      ? `Run (${cooldown}s)`
                      : "Run"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedVersion || isRunning}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-foreground"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </ButtonGroup>
            </div>
          </div>
          <div className="flex-1 overflow-hidden text-[14px]">
            <CodeMirror
              value={currentCode}
              height="100%"
              extensions={[java()]}
              onChange={(val) => setCode(question.id, val)}
              theme={theme === "dark" ? "dark" : "light"}
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
              }}
            />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle
        className="w-full h-px"
        handleOrientation="horizontal"
        withHandle
      />
      <ResizablePanel defaultSize={40} minSize={20}>
        <TestCaseConsole
          testCases={question.testCases}
          results={results}
          consoleOutput={consoleOutput}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isRunning={isRunning}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
