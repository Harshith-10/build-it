"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { ArrowLeft, ChevronDown, Loader2, Play, Send } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TestCaseConsole from "@/components/exam/test-case-console";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoilerplateFolding } from "@/hooks/use-boilerplate-folding";
import { useCodeRuntime } from "@/hooks/use-code-runtime";
import { useCode365Execution } from "@/hooks/use-code365-execution";
import { cn, formatMarkdown } from "@/lib/utils";

// Local storage key for storing code per problem & language
const getCodeStorageKey = (problemId: string, language: string) =>
  `code365_${problemId}_${language}`;

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

interface WorkspaceProps {
  problem: {
    id: string;
    title: string;
    problemStatement: string;
    difficulty: string;
    inputFormat?: string | null;
    outputFormat?: string | null;
    constraints?: string | null;
    tags: string[];
    driverCode: Record<string, string> | null;
    testCases: TestCase[];
  };
  userId: string;
  userRole?: string | null;
}

export default function WorkspaceClient({
  problem,
  userId,
  userRole,
}: WorkspaceProps) {
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
    questionId: problem.id,
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
  } = useCode365Execution();

  // Local Code State
  const [code, setCode] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update code when language changes, restoring from local storage or driver code
  useEffect(() => {
    if (!mounted || !selectedLanguage) return;

    const savedCode = localStorage.getItem(
      getCodeStorageKey(problem.id, selectedLanguage),
    );
    if (savedCode) {
      setCode(savedCode);
    } else {
      const defaultCode =
        (problem.driverCode as Record<string, string> | null)?.[
          selectedLanguage
        ] || "";
      setCode(defaultCode);
    }
  }, [selectedLanguage, problem.id, problem.driverCode, mounted]);

  const handleCodeChange = (val: string) => {
    setCode(val);
    localStorage.setItem(getCodeStorageKey(problem.id, selectedLanguage), val);
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading Workspace...
      </div>
    );
  }

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

  const availableLanguages = Array.from(
    new Set(runtimes.map((r) => r.language)),
  ).sort();

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-4">
          <Link href="/playground">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{problem.title}</h1>
            <Badge
              variant="outline"
              className={cn(
                "capitalize px-2 py-0.5 text-xs",
                problem.difficulty?.toLowerCase() === "easy"
                  ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : problem.difficulty?.toLowerCase() === "medium"
                    ? "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "border-rose-500/20 bg-rose-500/15 text-rose-600 dark:text-rose-400",
              )}
            >
              {problem.difficulty || "Medium"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/playground">Dashboard</Link>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Left Pane: Problem Description */}
          <ResizablePanel defaultSize={40} minSize={30} className="relative h-full flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 pb-24">
                <div className="max-w-none grid grid-cols-[minmax(0,1fr)]">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ className, ...props }) => (
                        <h1
                          className={cn(
                            "scroll-m-20 text-3xl font-bold tracking-tight mb-4",
                            className,
                          )}
                          {...props}
                        />
                      ),
                      h2: ({ className, ...props }) => (
                        <h2
                          className={cn(
                            "mt-8 scroll-m-20 border-b pb-1 text-2xl font-semibold tracking-tight first:mt-0",
                            className,
                          )}
                          {...props}
                        />
                      ),
                      h3: ({ className, ...props }) => (
                        <h3
                          className={cn(
                            "mt-6 scroll-m-20 text-xl font-semibold tracking-tight",
                            className,
                          )}
                          {...props}
                        />
                      ),
                      p: ({ className, ...props }) => (
                        <p
                          className={cn(
                            "leading-7 [&:not(:first-child)]:mt-4",
                            className,
                          )}
                          {...props}
                        />
                      ),
                      ul: ({ className, ...props }) => (
                        <ul
                          className={cn("my-4 ml-6 list-disc", className)}
                          {...props}
                        />
                      ),
                      ol: ({ className, ...props }) => (
                        <ol
                          className={cn("my-4 ml-6 list-decimal", className)}
                          {...props}
                        />
                      ),
                      li: ({ className, ...props }) => (
                        <li className={cn("mt-2", className)} {...props} />
                      ),
                      pre: ({ className, ...props }) => (
                        <ScrollArea className="mb-4 mt-4 rounded-lg border max-w-full">
                          <pre
                            className={cn(
                              "px-4 py-4 [&_code]:border-none [&_code]:bg-transparent [&_code]:p-0",
                              className,
                            )}
                            {...props}
                          />
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      ),
                      code: ({ className, ...props }) => (
                        <code
                          className={cn(
                            "relative rounded border bg-primary/10 px-[0.3rem] py-[0.2rem] font-mono text-sm",
                            className,
                          )}
                          {...props}
                        />
                      ),
                    }}
                  >
                    {formatMarkdown(problem.problemStatement)}
                  </Markdown>

                  {problem.inputFormat && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-2">
                        Input Format
                      </h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {formatMarkdown(problem.inputFormat)}
                        </Markdown>
                      </div>
                    </div>
                  )}

                  {problem.outputFormat && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-2">
                        Output Format
                      </h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {formatMarkdown(problem.outputFormat)}
                        </Markdown>
                      </div>
                    </div>
                  )}

                  {problem.constraints && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-2">
                        Constraints
                      </h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {formatMarkdown(problem.constraints)}
                        </Markdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle handleOrientation="vertical" />

          {/* Right Pane: Editor & Test Cases */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="flex h-full flex-col">
                  {/* Editor Toolbar */}
                  <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1">
                    <div className="flex items-center gap-3">
                      <Select
                        value={selectedLanguage}
                        onValueChange={setSelectedLanguage}
                        disabled={
                          runtimeLoading || availableLanguages.length === 0
                        }
                      >
                        <SelectTrigger className="w-[110px] h-8 text-sm">
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

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
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
                                onClick={() =>
                                  setSelectedVersion(runtime.version)
                                }
                                className={
                                  selectedVersion === runtime.version
                                    ? "bg-accent"
                                    : undefined
                                }
                              >
                                {runtime.language} {runtime.version}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                      <ButtonGroup>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleRun({
                              code,
                              language: selectedLanguage,
                              version: selectedVersion,
                              testCases: problem.testCases,
                            })
                          }
                          disabled={
                            isRunning || !selectedVersion || cooldown > 0
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
                              problemId: problem.id,
                              code,
                              language: selectedLanguage,
                              version: selectedVersion,
                            })
                          }
                          disabled={
                            isSubmitting || !selectedVersion || isRunning
                          }
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white dark:text-foreground"
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

                  {/* Code Editor */}
                  <div className="relative flex-1 overflow-hidden text-[14px]">
                    <CodeMirror
                      key={problem.id}
                      value={code}
                      height="100%"
                      extensions={[
                        getLanguageExtension(selectedLanguage),
                        EditorState.tabSize.of(4),
                      ]}
                      onChange={handleCodeChange}
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
                  testCases={problem.testCases}
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
