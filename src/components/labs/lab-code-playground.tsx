"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDown, Loader2, Play } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { useCodeExecution } from "@/hooks/use-code-execution";
import { useCodeRuntime } from "@/hooks/use-code-runtime";
import TestCaseConsole from "@/components/exam/test-case-console";
import type { LabProgram, LabExercise } from "./lab-ide-shell";
import { markProgramSolved } from "@/actions/student/labs/submissions";
import { toast } from "sonner";

interface LabCodePlaygroundProps {
  program: LabProgram;
  exercise: LabExercise;
  labId: string;
  isSolved: boolean;
  onSolved: () => void;
  // ✅ notify parent when test cases all pass
  onCanMarkSolvedChange?: (canMark: boolean) => void;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "java": return java();
    case "python": return python();
    case "rust": return rust();
    case "cpp":
    case "c": return cpp();
    default: return java();
  }
}

function formatLanguageName(lang: string) {
  const nameMap: Record<string, string> = {
    cpp: "C++", c: "C", java: "Java", python: "Python",
    javascript: "JavaScript", typescript: "TypeScript",
    rust: "Rust", go: "Go", csharp: "C#",
  };
  return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function LabCodePlayground({
  program,
  exercise,
  labId,
  isSolved: initialSolved,
  onSolved,
  onCanMarkSolvedChange,
}: LabCodePlaygroundProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");

  const {
    runtimes,
    selectedLanguage,
    setSelectedLanguage,
    selectedVersion,
    setSelectedVersion,
    isLoading: runtimeLoading,
  } = useCodeRuntime();

  const {
    isRunning,
    activeTab,
    setActiveTab,
    customInput,
    setCustomInput,
    results,
    consoleOutput,
    cooldown,
    handleRun,
  } = useCodeExecution();

  const storageKey = `lab_code_${exercise.id}_${program.id}`;
  const langKey = `lab_lang_${exercise.id}_${program.id}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load code & language from localStorage when program or exercise changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCode = localStorage.getItem(storageKey) ?? "";
    setCode(savedCode);

    const savedLang = localStorage.getItem(langKey);
    if (savedLang) {
      setSelectedLanguage(savedLang);
    }
  }, [exercise.id, program.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeChange = (val: string) => {
    setCode(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, val);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(langKey, lang);
    }
  };

  // ✅ Notify parent when canMarkSolved changes and auto-submit if all hidden test cases pass
  useEffect(() => {
    // Check results against corresponding testCase.isHidden
    const hiddenResults = results.filter(
      (_, index) => program.testCases[index]?.isHidden === true
    );
    const allHiddenPassed =
      hiddenResults.length > 0 && hiddenResults.every((r) => r.passed);

    // Fallback to checking all test cases if there are no hidden ones
    const hasHidden = program.testCases.some((tc) => tc.isHidden);
    const canMark = hasHidden
      ? allHiddenPassed
      : results.length > 0 &&
        results.length === program.testCases.length &&
        results.every((r) => r.passed);

    onCanMarkSolvedChange?.(canMark);

    if (canMark && !initialSolved) {
      const autoSubmit = async () => {
        try {
          const res = await markProgramSolved({
            programId: program.id,
            exerciseId: exercise.id,
            code,
            language: selectedLanguage,
          });
          if (res.success) {
            onSolved();
            toast.success("All hidden test cases passed! Code submitted successfully.");
          } else {
            toast.error(res.error ?? "Failed to auto-submit code");
          }
        } catch (err) {
          console.error("Auto-submit error:", err);
        }
      };
      autoSubmit();
    }
  }, [results, initialSolved, program.id, exercise.id, onSolved, onCanMarkSolvedChange, program.testCases.length]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading Editor...
      </div>
    );
  }

  const availableLanguages = Array.from(
    new Set(runtimes.map((r) => r.language))
  ).sort();

  const handleRunCode = () =>
    handleRun({
      code,
      language: selectedLanguage,
      version: selectedVersion,
      testCases: program.testCases,
    });

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          {/* ✅ Clean toolbar — language + version + theme + run only */}
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1 shrink-0">
            <div className="flex items-center gap-3">
              <Select
                value={selectedLanguage}
                onValueChange={handleLanguageChange}
                disabled={runtimeLoading || availableLanguages.length === 0}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {runtimeLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : availableLanguages.length === 0 ? (
                    <SelectItem value="none" disabled>No languages</SelectItem>
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunCode}
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
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden text-[14px]">
            <CodeMirror
              key={`${exercise.id}_${program.id}`}
              value={code}
              height="100%"
              extensions={[
                getLanguageExtension(selectedLanguage),
                EditorState.tabSize.of(4),
              ]}
              onChange={(val) => handleCodeChange(val)}
              theme={theme === "dark" ? "dark" : "light"}
              className="h-full"
              basicSetup={{ lineNumbers: true, foldGutter: true }}
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
          testCases={program.testCases}
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