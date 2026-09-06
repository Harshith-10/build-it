"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { EditorState } from "@codemirror/state";
import CodeMirror from "@uiw/react-codemirror";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Play,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { markProgramSolved } from "@/actions/student/labs/submissions";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCodeExecution } from "@/hooks/use-code-execution";
import { useCodeRuntime } from "@/hooks/use-code-runtime";

// ─── Types ────────────────────────────────────────────────────────────────────

type Program = {
  id: string;
  programNo: number;
  title: string;
  description?: string | null;
};

type Exercise = {
  id: string;
  exerciseNo: number;
  title: string;
  description?: string | null;
};

interface LabCodeEditorProps {
  program: Program;
  exercise: Exercise;
  labId: string;
  isSolved: boolean;
}

// ─── Language helpers ─────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function LabCodeEditor({
  program,
  exercise,
  labId,
  isSolved: initialSolved,
}: LabCodeEditorProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [isSolved, setIsSolved] = useState(initialSolved);
  const [isMarking, setIsMarking] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [customInput, setCustomInput] = useState("");

  const {
    runtimes,
    selectedLanguage,
    setSelectedLanguage,
    selectedVersion,
    setSelectedVersion,
    isLoading: runtimeLoading,
  } = useCodeRuntime();

  const { isRunning, cooldown, handleRun } = useCodeExecution();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading Editor...
      </div>
    );
  }

  const availableLanguages = Array.from(
    new Set(runtimes.map((r) => r.language))
  ).sort();

  const handleMarkSolved = async () => {
    setIsMarking(true);
    try {
      const res = await markProgramSolved({
        programId: program.id,
        exerciseId: exercise.id,
        code,
        language: selectedLanguage,
      });

      if (res.success) {
        setIsSolved(true);
        toast.success("Code submitted successfully!");
        // Go back to exercise page after a short delay
        setTimeout(() => {
          router.push(`/labs/${labId}/${exercise.id}`);
        }, 1000);
      } else {
        toast.error(res.error ?? "Failed to submit code");
      }
    } finally {
      setIsMarking(false);
    }
  };

  const handleRunCode = async () => {
    await handleRun({
      code,
      language: selectedLanguage,
      version: selectedVersion,
      testCases: [], // labs have no test cases
    });
  };

  return (
    <div className="flex inset-0 z-50 flex flex-col overflow-hidden bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Link href={`/labs/${labId}/${exercise.id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <span className="text-sm font-medium">
            {program.programNo}. {program.title}
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleMarkSolved}
          disabled={isMarking || isSolved}
          className={
            isSolved
              ? "bg-green-600 hover:bg-green-600 text-white gap-1.5"
              : "gap-1.5"
          }
        >
          {isMarking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSolved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
          {isSolved ? "Submitted" : "Submit"}
        </Button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full">

          {/* ── Left: program description ── */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Exercise {exercise.exerciseNo} · {exercise.title}
                  </p>
                  <h2 className="text-2xl font-bold">
                    {program.programNo}. {program.title}
                  </h2>
                  {isSolved && (
                    <div className="flex items-center gap-1.5 mt-2 text-green-500 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Solved
                    </div>
                  )}
                </div>
                {program.description && (
                  <div className="text-sm text-muted-foreground leading-relaxed border rounded-lg p-4 bg-muted/20">
                    {program.description}
                  </div>
                )}
                {!program.description && (
                  <div className="text-sm text-muted-foreground italic">
                    No description provided.
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle handleOrientation="vertical" />

          {/* ── Right: code editor + console ── */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <ResizablePanelGroup orientation="vertical">

              {/* ── Code editor ── */}
              <ResizablePanel defaultSize={65} minSize={30}>
                <div className="flex h-full flex-col">
                  {/* Editor toolbar */}
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
                                className={selectedVersion === runtime.version ? "bg-accent" : undefined}
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
                        {isRunning ? "Running..." : cooldown > 0 ? `Run (${cooldown}s)` : "Run"}
                      </Button>
                    </div>
                  </div>

                  {/* CodeMirror */}
                  <div className="flex-1 overflow-hidden text-[14px]">
                    <CodeMirror
                      value={code}
                      height="100%"
                      extensions={[
                        getLanguageExtension(selectedLanguage),
                        EditorState.tabSize.of(4),
                      ]}
                      onChange={(val) => setCode(val)}
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

              {/* ── Console ── */}
              <ResizablePanel defaultSize={35} minSize={20}>
                <div className="flex h-full flex-col">
                  <div className="border-b bg-muted/20 px-4 py-2 flex items-center justify-between shrink-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Console Output
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResizablePanelGroup orientation="vertical">
                      <ResizablePanel defaultSize={60}>
                        <ScrollArea className="h-full">
                          <pre className="p-4 text-xs font-mono text-foreground">
                            {consoleOutput || "Run your code to see the output here..."}
                          </pre>
                        </ScrollArea>
                      </ResizablePanel>
                      <ResizableHandle
                        className="w-full h-px"
                        handleOrientation="horizontal"
                      />
                      <ResizablePanel defaultSize={40}>
                        <div className="flex h-full flex-col">
                          <div className="border-b px-4 py-1 shrink-0">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Standard Input (STDIN)
                            </span>
                          </div>
                          <textarea
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Enter custom input here..."
                            className="flex-1 resize-none bg-transparent p-4 text-xs font-mono text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                          />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}