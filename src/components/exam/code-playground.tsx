"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState } from "@codemirror/state";
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
  userId: string;
  isCodingLocked?: boolean;
  latestSubmissions?: Record<string, Record<string, string>>;
}

export function CodePlayground({
  question,
  assignmentId,
  userId,
  isCodingLocked = false,
  latestSubmissions,
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

  const driverCode =
    (question.driverCode as Record<string, string> | null)?.[
      selectedLanguage
    ] || "";

  const examCode = code[assignmentId];
  const latestSubmittedCode = latestSubmissions?.[question.id]?.[selectedLanguage];

  const localDraft =
    examCode && question.id in examCode && examCode[question.id]?.[selectedLanguage]
      ? examCode[question.id][selectedLanguage]
      : undefined;

  // 1. Local Draft (Highest priority)
  // 2. Latest Submitted Code (DB recovery anchor)
  // 3. Question Driver / Template Code
  const currentCode = localDraft ?? latestSubmittedCode ?? driverCode;

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

  // Get unique languages from available runtimes
  const availableLanguages = Array.from(
    new Set(runtimes.map((r) => r.language)),
  ).sort();

  // Helper to format language names for display
  const formatLanguageName = (lang: string) => {
    const nameMap: Record<string, string> = {
      cpp: "C++",
      c: "C",
      java: "Java",
      python: "Python",
      javascript: "JavaScript",
      typescript: "TypeScript",
      rust: "Rust",
      go: "Go",
      csharp: "C#",
      ruby: "Ruby",
      php: "PHP",
      swift: "Swift",
      kotlin: "Kotlin",
      zig: "Zig",
    };
    return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
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
                disabled={runtimeLoading || availableLanguages.length === 0}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {runtimeLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableLanguages.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No languages available
                    </SelectItem>
                  ) : (
                    availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {formatLanguageName(lang)}
                      </SelectItem>
                    ))
                  )}
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
                      assignmentId,
                      code: currentCode,
                      language: selectedLanguage,
                      version: selectedVersion,
                      testCases: question.testCases,
                    })
                  }
                  disabled={
                    isCodingLocked ||
                    isRunning ||
                    !selectedVersion ||
                    cooldown > 0
                  }
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
                  disabled={
                    isCodingLocked ||
                    isSubmitting ||
                    !selectedVersion ||
                    isRunning
                  }
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
          <div className="relative flex-1 overflow-hidden text-[14px]">
            <CodeMirror
              key={question.id}
              value={currentCode}
              height="100%"
              extensions={[
                getLanguageExtension(selectedLanguage),
                EditorState.tabSize.of(4),
              ]}
              onChange={(val) =>
                setCode(assignmentId, question.id, selectedLanguage, val)
              }
              theme={theme === "dark" ? "dark" : "light"}
              className="h-full"
              editable={!isCodingLocked}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
              }}
              onCreateEditor={onCreateEditor}
            />
            {isCodingLocked && (
              <div className="absolute bottom-3 right-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Coding window ended. Use End Exam to submit.
              </div>
            )}
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
