"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDown, Loader2, Play, RotateCcw, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { runCode } from "@/actions/student/exams/code-actions";
import { toast } from "sonner";

interface LabCodePlaygroundProps {
  program: LabProgram;
  exercise: LabExercise;
  labId: string;
  isSolved: boolean;
  onSolved: () => void;
  onUnsolved?: () => void;
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
  onUnsolved,
  onCanMarkSolvedChange,
}: LabCodePlaygroundProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
    setResults,
    consoleOutput,
    setConsoleOutput,
    cooldown,
    handleRun,
  } = useCodeExecution();

  const storageKey = `lab_code_${exercise.id}_${program.id}`;
  const langKey = `lab_lang_${exercise.id}_${program.id}`;

  const allowed = (program.allowedLanguages && program.allowedLanguages.length > 0)
    ? program.allowedLanguages
    : ["java"];

  const availableLanguages = Array.from(
    new Set(
      runtimes
        .map((r) => r.language)
        .filter((lang) => allowed.includes(lang))
    )
  ).sort();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load code & language from localStorage or initial submission when program or exercise changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCode = localStorage.getItem(storageKey);
    if (savedCode !== null && savedCode !== "") {
      setCode(savedCode);
    } else if (program.initialCode) {
      setCode(program.initialCode);
      localStorage.setItem(storageKey, program.initialCode);
    } else {
      setCode("");
    }

    const savedLang = localStorage.getItem(langKey);
    const initialCleanLang = program.initialLanguage?.split(":")[0];
    if (savedLang && allowed.includes(savedLang)) {
      setSelectedLanguage(savedLang);
    } else if (initialCleanLang && allowed.includes(initialCleanLang)) {
      setSelectedLanguage(initialCleanLang);
    } else if (availableLanguages.length > 0 && !allowed.includes(selectedLanguage)) {
      setSelectedLanguage(availableLanguages[0]);
    }
  }, [exercise.id, program.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache latest test results in localStorage for the lab report
  useEffect(() => {
    if (results && results.length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `lab_test_results_${exercise.id}_${program.id}`,
          JSON.stringify(results)
        );
      } catch (e) {
        console.error("Failed to cache test results:", e);
      }
    }
  }, [results, exercise.id, program.id]);

  // Switch language if current selection is not allowed for this program
  useEffect(() => {
    if (availableLanguages.length > 0 && !availableLanguages.includes(selectedLanguage)) {
      handleLanguageChange(availableLanguages[0]);
    }
  }, [availableLanguages, selectedLanguage, program.id]);

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

  const handleResetCode = () => {
    if (!code || code.trim().length === 0) return;
    setShowClearConfirm(true);
  };

  const handleConfirmReset = () => {
    setCode("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setShowClearConfirm(false);
    toast.info("Editor code cleared.");
  };

  const handleRunCode = () =>
    handleRun({
      code,
      language: selectedLanguage,
      version: selectedVersion,
      testCases: program.testCases,
    });

  const handleSubmitCode = async () => {
    if (!selectedVersion) {
      toast.error(`No ${selectedLanguage} runtime available.`);
      return;
    }
    if (!code || code.trim().length === 0) {
      toast.error("Please write code before submitting.");
      return;
    }
    if (isRunning || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await runCode({
        code,
        language: selectedLanguage,
        version: selectedVersion,
        testCases: program.testCases,
      });

      if (result.compilationError) {
        // Save submission as attempted (0 test cases passed)
        await markProgramSolved({
          programId: program.id,
          exerciseId: exercise.id,
          code,
          language: selectedLanguage,
          isSolved: false,
        });
        onUnsolved?.();

        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Compilation Error:\n${result.compilationError}`,
        });
        toast.error("Code saved, but failed to compile. 0 marks awarded until test cases pass.");
        return;
      }

      if (!result.success) {
        // Save submission as attempted
        await markProgramSolved({
          programId: program.id,
          exerciseId: exercise.id,
          code,
          language: selectedLanguage,
          isSolved: false,
        });
        onUnsolved?.();

        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: result.error || "Execution failed",
        });
        toast.error(result.error || "Execution failed. Code saved as attempt.");
        return;
      }

      if (result.results) {
        setResults(result.results);
        setActiveTab("results");

        // Hidden test cases check (or fallback to all test cases if none are marked hidden)
        const hiddenCases = program.testCases.filter((tc) => tc.isHidden);
        const requiredCases = hiddenCases.length > 0 ? hiddenCases : program.testCases;

        const allPassed =
          requiredCases.length > 0
            ? requiredCases.every((tc) => {
                const r = result.results?.find((res) => res.id === tc.id);
                return r?.passed === true;
              })
            : (result.success && !result.compilationError);

        const passedCount = result.results.filter((r) => r.passed).length;
        const totalCount = program.testCases.length;

        // Save code into DB with accurate isSolved flag
        const saveRes = await markProgramSolved({
          programId: program.id,
          exerciseId: exercise.id,
          code,
          language: selectedLanguage,
          isSolved: allPassed,
        });

        if (!saveRes.success) {
          console.error("Failed to save submission:", saveRes.error);
        }

        if (allPassed) {
          onSolved();
          toast.success("Question submitted successfully! All test cases passed.");
        } else {
          onUnsolved?.();
          toast.warning(`Code submitted & saved (${passedCount}/${totalCount} test cases passed). Pass all required test cases to earn marks.`);
        }
      }
    } catch (err) {
      console.error("[handleSubmitCode] error:", err);
      toast.error("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading Editor...
      </div>
    );
  }

  return (
    <>
      <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          {/* ✅ Toolbar — language + version + theme + run and submit buttons */}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetCode}
                title="Clear code from editor"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
              <ThemeToggle />
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting || !selectedVersion || cooldown > 0}
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
                  onClick={handleSubmitCode}
                  disabled={isRunning || isSubmitting || !selectedVersion}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
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
          isRunning={isRunning || isSubmitting}
        />
      </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Editor Code?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear the editor? Any code written for this question will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Clear Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}