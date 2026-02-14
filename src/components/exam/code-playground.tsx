"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDown, Loader2, Play, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoilerplateFolding } from "@/hooks/use-boilerplate-folding";
import { useCodeExecution } from "@/hooks/use-code-execution";
import { useCodeRuntime } from "@/hooks/use-code-runtime";
import { useExamStore } from "@/stores/exam-store";
import { ThemeToggle } from "../theme-toggle";
import { ButtonGroup } from "../ui/button-group";
import type { Question } from "./ide-shell";
import TestCaseConsole from "./test-case-console";

interface CodePlaygroundProps {
  question: Question;
  assignmentId: string;
}

export function CodePlayground({
  question,
  assignmentId,
}: CodePlaygroundProps) {
  const { code, setCode } = useExamStore();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hooks
  const {
    runtimes,
    selectedLanguage,
    setSelectedLanguage,
    selectedVersion,
    setSelectedVersion,
    isLoading: runtimeLoading,
  } = useCodeRuntime();

  const { onCreateEditor } = useBoilerplateFolding({
    questionId: question.id,
    language: selectedLanguage,
  });

  const {
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
  } = useCodeExecution();

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

  const defaultCode =
    (question.driverCode as Record<string, string> | null)?.[
      selectedLanguage
    ] || "";

  const currentCode =
    question.id in code && code[question.id]?.[selectedLanguage]
      ? code[question.id][selectedLanguage]
      : defaultCode;

  const getLanguageExtension = (lang: string) => {
    switch (lang) {
      case "java":
        return java();
      case "python":
        return python();
      case "rust":
        return rust();
      case "cpp":
      case "c":
        return cpp();
      default:
        return java();
    }
  };

  return (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1">
            <div className="flex items-center gap-3">
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="rust">Rust</SelectItem>
                </SelectContent>
              </Select>

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
                        ? `${selectedLanguage} ${selectedVersion}`
                        : `No ${selectedLanguage} Runtime`}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {runtimes
                    .filter((r) => r.language === selectedLanguage)
                    .map((runtime) => (
                      <DropdownMenuItem
                        key={`${runtime.language}-${runtime.version}`}
                        onClick={() => setSelectedVersion(runtime.version)}
                        className={
                          selectedVersion === runtime.version
                            ? "bg-accent"
                            : undefined
                        }
                      >
                        {runtime.language} {runtime.version}
                      </DropdownMenuItem>
                    ))}
                  {runtimes.filter((r) => r.language === selectedLanguage)
                    .length === 0 &&
                    !runtimeLoading && (
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
                  onClick={() =>
                    handleRun({
                      code: currentCode,
                      language: selectedLanguage,
                      version: selectedVersion,
                      testCases: question.testCases,
                    })
                  }
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
                  onClick={() =>
                    handleSubmit({
                      assignmentId,
                      questionId: question.id,
                      code: currentCode,
                      language: selectedLanguage,
                      version: selectedVersion,
                    })
                  }
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
              key={question.id}
              value={currentCode}
              height="100%"
              extensions={[getLanguageExtension(selectedLanguage)]}
              onChange={(val) => setCode(question.id, selectedLanguage, val)}
              theme={theme === "dark" ? "dark" : "light"}
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
              }}
              onCreateEditor={onCreateEditor}
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
