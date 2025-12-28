"use client";

import { java } from "@codemirror/lang-java";
import CodeMirror from "@uiw/react-codemirror";
import { Play, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useExamStore } from "@/stores/exam-store";
import type { TestcaseResult } from "@/types/problem";
import type { Question } from "./ide-shell";
import TestCaseConsole from "./test-case-console";
import { ThemeToggle } from "../theme-toggle";
import { ButtonGroup } from "../ui/button-group";

interface CodePlaygroundProps {
  question: Question;
}

export function CodePlayground({ question }: CodePlaygroundProps) {
  const { code, setCode } = useExamStore();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // Console State
  const [activeTab, setActiveTab] = useState("test-cases");
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<TestcaseResult[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout: string;
    stderr: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading Editor...
      </div>
    );
  }

  const defaultCode = `// Write your Java code for ${question.title} here\n\nclass Solution {\n    public void solve() {\n        // Your code here\n    }\n}`;
  const currentCode = code[question.id] || defaultCode;

  const handleRun = async () => {
    setIsRunning(true);
    setActiveTab("results");
    // TODO: Implement actual code execution via server action
    // For now, simulate a delay
    await new Promise((r) => setTimeout(r, 1000));
    setIsRunning(false);
    // Mock results for UI demonstration
    setResults(
      question.testCases.map((tc) => ({
        id: tc.id,
        passed: Math.random() > 0.5,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "Sample output",
        run_details: { stdout: "Sample output", stderr: "" },
      })),
    );
  };

  const handleSubmit = async () => {
    // TODO: Implement submission logic
    console.log("Submit clicked");
  };

  return (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
            <span className="text-sm font-medium">Solution.java</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRun}
                  disabled={isRunning}
                  className="gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  {isRunning ? "Running..." : "Run"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-foreground"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit
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
      <ResizableHandle />
      <ResizablePanel defaultSize={40} minSize={20}>
        <TestCaseConsole
          testCases={question.testCases}
          results={results}
          consoleOutput={consoleOutput}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
