"use client";

import { Check, Terminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Problem, TestcaseResult } from "@/types/problem";

interface TestCaseConsoleProps {
  testCases: Problem["testCases"];
  results: TestcaseResult[];
  consoleOutput: { stdout: string; stderr: string } | null;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isRunning?: boolean;
}

export default function TestCaseConsole({
  testCases,
  results,
  consoleOutput,
  customInput,
  onCustomInputChange,
  activeTab,
  onTabChange,
  isRunning = false,
}: TestCaseConsoleProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  useEffect(() => {
    const visibleTestCases = testCases.filter((tc) => !tc.isHidden);
    if (visibleTestCases.length > 0) {
      setSelectedCaseId(visibleTestCases[0].id.toString());
    } else if (testCases.length > 0) {
      setSelectedCaseId("hidden-cases-summary");
    } else {
      setSelectedCaseId("");
    }
  }, [testCases]);

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden">
      <div className="border-b p-2">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
            <TabsTrigger value="results">
              Test Results
              {results.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-2 h-5 px-1.5 text-[10px] gap-1"
                >
                  <Check className="w-3 h-3 text-green-500" />
                  {results.filter((r) => r.passed).length} / {results.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="custom">Input / Output</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {activeTab === "test-cases" && (
          <div className="h-full flex flex-col">
            {testCases.filter((tc) => !tc.isHidden).length === 0 ? (
              <div className="text-muted-foreground text-sm py-4">
                No public test cases visible.
              </div>
            ) : (
              <div className="flex h-full gap-4">
                {/* Left List */}
                <div className="w-32 flex flex-col gap-1 border-r pr-2 shrink-0">
                  {testCases
                    .filter((tc) => !tc.isHidden)
                    .map((tc, idx) => (
                      <button
                        type="button"
                        key={tc.id}
                        onClick={() => setSelectedCaseId(tc.id.toString())}
                        className={cn(
                          "text-xs text-left px-3 py-2 rounded-md transition-colors",
                          selectedCaseId === tc.id.toString()
                            ? "bg-secondary font-medium text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                </div>
                {/* Right Details */}
                <ScrollArea className="flex-1 h-full">
                  {testCases
                    .filter((tc) => !tc.isHidden)
                    .map(
                      (tc) =>
                        tc.id.toString() === selectedCaseId && (
                          <div key={tc.id} className="space-y-4">
                            <div>
                              <Label className="text-xs text-muted-foreground uppercase">
                                Input
                              </Label>
                              <div className="mt-1.5 p-3 rounded-md bg-muted/40 font-mono text-sm whitespace-pre-wrap">
                                {tc.input}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground uppercase">
                                Expected Output
                              </Label>
                              <div className="mt-1.5 p-3 rounded-md bg-muted/40 font-mono text-sm whitespace-pre-wrap">
                                {tc.expectedOutput}
                              </div>
                            </div>
                          </div>
                        ),
                    )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {activeTab === "results" && (
          <div className="h-full flex flex-col">
            {isRunning ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground animate-pulse">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Running Execution...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Run your code to see results</p>
              </div>
            ) : (
              <div className="flex h-full gap-4">
                {/* Left List (Results) */}
                <div className="w-32 flex flex-col gap-1 border-r pr-2 shrink-0 overflow-y-auto">
                  {results
                    .filter((_, idx) => !testCases[idx]?.isHidden)
                    .map((res, idx) => (
                      <button
                        type="button"
                        key={res.id}
                        onClick={() => setSelectedCaseId(res.id.toString())}
                        className={cn(
                          "text-xs text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between",
                          selectedCaseId === res.id.toString()
                            ? "bg-secondary font-medium text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span>Case {idx + 1}</span>
                        {res.passed ? (
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                      </button>
                    ))}

                  {/* Hidden Cases Summary Row */}
                  {results.some((_, idx) => testCases[idx]?.isHidden) && (
                    <button
                      type="button"
                      onClick={() => setSelectedCaseId("hidden-cases-summary")}
                      className={cn(
                        "text-xs text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between mt-2 border-t pt-3 border-dashed",
                        selectedCaseId === "hidden-cases-summary"
                          ? "bg-secondary font-medium text-secondary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="font-semibold">Hidden Cases</span>
                      {results.filter((res, idx) => testCases[idx]?.isHidden).every((r) => r.passed) ? (
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                    </button>
                  )}
                </div>

                {/* Right Details */}
                <ScrollArea className="flex-1 h-full">
                  {/* Public Results Details */}
                  {results
                    .filter((_, idx) => !testCases[idx]?.isHidden)
                    .map(
                      (res) =>
                        res.id.toString() === selectedCaseId && (
                          <div key={res.id} className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={cn(
                                  "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                  res.passed
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                                )}
                              >
                                {res.passed ? "Passed" : "Failed"}
                              </span>
                            </div>

                            {res.run_details.stderr && (
                              <div>
                                <Label className="text-xs text-red-500 uppercase">
                                  Error Helper
                                </Label>
                                <div className="mt-1.5 p-3 rounded-md bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-mono text-xs whitespace-pre-wrap">
                                  {res.run_details.stderr}
                                </div>
                              </div>
                            )}

                            <div>
                              <Label className="text-xs text-muted-foreground uppercase">
                                Input
                              </Label>
                              <div className="mt-1.5 p-3 rounded-md bg-muted/40 font-mono text-sm whitespace-pre-wrap">
                                {res.input}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground uppercase">
                                Output
                              </Label>
                              <div
                                className={cn(
                                  "mt-1.5 p-3 rounded-md font-mono text-sm whitespace-pre-wrap",
                                  res.passed
                                    ? "bg-muted/40"
                                    : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900",
                                )}
                              >
                                {res.actualOutput || (
                                  <span className="text-muted-foreground italic">
                                    No output
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground uppercase">
                                Expected
                              </Label>
                              <div className="mt-1.5 p-3 rounded-md bg-muted/40 font-mono text-sm whitespace-pre-wrap">
                                {res.expectedOutput}
                              </div>
                            </div>
                          </div>
                        ),
                    )}

                  {/* Hidden Results Summary Details */}
                  {selectedCaseId === "hidden-cases-summary" &&
                    results.some((_, idx) => testCases[idx]?.isHidden) && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                              results.filter((res, idx) => testCases[idx]?.isHidden).every((r) => r.passed)
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                            )}
                          >
                            {results.filter((res, idx) => testCases[idx]?.isHidden).every((r) => r.passed)
                              ? "Passed"
                              : "Failed"}
                          </span>
                        </div>

                        <div className="p-4 rounded-md bg-muted/20 border border-dashed text-sm">
                          <p className="font-semibold text-muted-foreground">Hidden Evaluation Cases</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Inputs, expected outputs, and execution console outputs are hidden to ensure evaluation integrity.
                          </p>
                          <div className="mt-4 flex items-center gap-2 text-xs font-medium">
                            <span>Status:</span>
                            <span
                              className={
                                results.filter((res, idx) => testCases[idx]?.isHidden).every((r) => r.passed)
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-500"
                              }
                            >
                              {results.filter((res, idx) => testCases[idx]?.isHidden && res.passed).length} /{" "}
                              {results.filter((res, idx) => testCases[idx]?.isHidden).length} passed
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {activeTab === "custom" && (
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="flex flex-col gap-2 h-full">
              <Label>Input</Label>
              <Textarea
                value={customInput}
                onChange={(e) => onCustomInputChange(e.target.value)}
                className="flex-1 font-mono text-sm resize-none bg-muted/30"
                placeholder="Enter custom input here..."
              />
            </div>
            <div className="flex flex-col gap-2 h-full">
              <Label>Output</Label>
              <div className="flex-1 rounded-md border bg-muted/50 p-3 font-mono text-sm whitespace-pre-wrap overflow-auto">
                {consoleOutput ? (
                  <>
                    {consoleOutput.stdout && (
                      <span className="block mb-2">{consoleOutput.stdout}</span>
                    )}
                    {consoleOutput.stderr && (
                      <span className="text-red-500 block">
                        {consoleOutput.stderr}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    Run your code to see output
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
