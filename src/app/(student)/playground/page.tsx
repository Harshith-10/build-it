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
import { runWithCustomInput } from "@/actions/student/exams/code-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { useCodeRuntime } from "@/hooks/use-code-runtime";

export default function PlaygroundPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<{
    stdout: string;
    stderr: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Hooks
  const {
    runtimes,
    selectedLanguage,
    setSelectedLanguage,
    selectedVersion,
    setSelectedVersion,
    isLoading: runtimeLoading,
  } = useCodeRuntime();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleRun = async () => {
    if (!selectedVersion) return;
    setIsRunning(true);
    setOutput(null);

    try {
      const res = await runWithCustomInput({
        code,
        language: selectedLanguage,
        version: selectedVersion,
        stdin: input,
      });

      if (res.success) {
        setOutput({
          stdout: res.stdout || "",
          stderr: res.stderr || res.compilationError || "",
        });
      } else {
        setOutput({
          stdout: "",
          stderr:
            res.error || res.compilationError || "An unknown error occurred",
        });
      }
    } catch (err) {
      setOutput({
        stdout: "",
        stderr: err instanceof Error ? err.message : "Failed to execute code",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading Code Playground...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden border rounded-lg shadow-sm">
      <div className="flex-1 overflow-hidden h-full">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          {/* Editor Panel */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="flex h-full flex-col border-r">
              <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1.5 shrink-0">
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedLanguage}
                    onValueChange={setSelectedLanguage}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-sm font-medium">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {runtimes.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          {runtimeLoading ? "Loading..." : "No languages found"}
                        </SelectItem>
                      ) : (
                        Array.from(
                          new Set(runtimes.map((r) => r.language)),
                        ).map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang.charAt(0).toUpperCase() + lang.slice(1)}
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
                        className="h-8 gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                        disabled={runtimeLoading || runtimes.length === 0}
                      >
                        {runtimeLoading
                          ? "Loading runtimes..."
                          : selectedVersion
                            ? `${selectedLanguage} ${selectedVersion}`
                            : `No ${selectedLanguage} Runtime`}
                        <ChevronDown className="h-3.5 w-3.5" />
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
                                ? "bg-accent font-medium"
                                : ""
                            }
                          >
                            {runtime.language} {runtime.version}
                          </DropdownMenuItem>
                        ))}
                      {runtimes.filter((r) => r.language === selectedLanguage)
                        .length === 0 &&
                        !runtimeLoading && (
                          <DropdownMenuItem disabled>
                            No runtimes for this language
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <ButtonGroup>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleRun}
                      disabled={isRunning || !selectedVersion || !code.trim()}
                      className="gap-2 h-8"
                    >
                      {isRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {isRunning ? "Running..." : "Run"}
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
              <div className="flex-1 overflow-auto text-[14px]">
                <CodeMirror
                  value={code}
                  height="100%"
                  extensions={[
                    getLanguageExtension(selectedLanguage),
                    EditorState.tabSize.of(4),
                  ]}
                  onChange={(val) => setCode(val)}
                  theme={theme === "dark" ? "dark" : "light"}
                  className="h-full min-h-full"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true,
                    autocompletion: true,
                  }}
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle
            className="w-1.5 bg-muted hover:bg-muted-foreground/20 transition-colors"
            withHandle
          />
          {/* Console Panel */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="flex h-full flex-col bg-background">
              {/* Output Section */}
              <div className="flex-1 flex flex-col border-b min-h-0">
                <div className="flex items-center px-4 py-2 border-b bg-muted/10 shrink-0">
                  <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">
                    Console Output
                  </Label>
                </div>
                <div className="flex-1 p-4 font-mono text-sm overflow-auto bg-black border-none text-white dark:bg-zinc-950">
                  {isRunning ? (
                    <div className="flex items-center text-muted-foreground/70 animate-pulse">
                      <span className="mr-2">&gt;</span> Executing code...
                    </div>
                  ) : output ? (
                    <div className="whitespace-pre-wrap break-all flex flex-col gap-2">
                      {output.stdout && (
                        <div className="text-zinc-300">{output.stdout}</div>
                      )}
                      {output.stderr && (
                        <div className="text-red-400">{output.stderr}</div>
                      )}
                      {!output.stdout && !output.stderr && (
                        <div className="text-zinc-500 italic">
                          (Program exited with no output)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-zinc-600 italic">
                      Run your code to see the output here...
                    </div>
                  )}
                </div>
              </div>

              {/* Input Section */}
              <div className="h-48 flex flex-col shrink-0">
                <div className="flex items-center px-4 py-2 border-b bg-muted/10 shrink-0">
                  <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">
                    Standard Input (stdin)
                  </Label>
                </div>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter custom input here..."
                  className="flex-1 border-0 focus-visible:ring-0 rounded-none resize-none font-mono text-sm p-4 bg-muted/5"
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
