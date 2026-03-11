"use client";

import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { zodResolver } from "@hookform/resolvers/zod";
import CodeMirror from "@uiw/react-codemirror";
import {
  Code2,
  EyeOff,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import * as z from "zod";
import { upsertProblem } from "@/actions/admin/problems";
import { getRuntimes, runCode } from "@/actions/student/exams/code-actions";
import { useJetStore } from "@/components/store/use-jet-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProblemStore } from "./use-problem-store";

// Schema
const problemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  problemStatement: z.string().min(10, "Problem statement is required"),
  driverCode: z.record(z.string(), z.string()).optional(),
  allowedLanguages: z.array(z.string()).default(["java"]),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isHidden: z.boolean().default(false),
    }),
  ),
});

type ProblemFormValues = z.infer<typeof problemSchema>;

const defaultDriverCode = `// Write your driver code here
// This code will wrap the user's solution
`;

// biome-ignore lint/suspicious/noExplicitAny: CodeMirror language extension types
const languageExtensions: Record<string, () => any> = {
  javascript: () => javascript(),
  python: () => python(),
  java: () => java(),
};

// biome-ignore lint/suspicious/noExplicitAny: Form initialData accepts any shape
export function ProblemForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    allowedLanguages,
    driverCodeMap,
    toggleAllowedLanguage,
    setDriverCode,
    initialize,
  } = useProblemStore();

  const [codeTabLang, setCodeTabLang] = useState("java");
  const [verifyTabLang, setVerifyTabLang] = useState("java");
  const [isVerifying, setIsVerifying] = useState(false);
  // biome-ignore lint/suspicious/noExplicitAny: Verify result typing
  const [verifyResults, setVerifyResults] = useState<any[] | null>(null);
  const [availableRuntimes, setAvailableRuntimes] = useState<
    { language: string; version: string }[]
  >([]);
  const [languageVersionMap, setLanguageVersionMap] = useState<
    Record<string, string>
  >({});
  const [verifyCodeMap, setVerifyCodeMap] = useState<Record<string, string>>(
    {},
  );

  const { isOnline } = useJetStore();

  useEffect(() => {
    if (initialData) {
      initialize(
        initialData.allowedLanguages || ["java"],
        initialData.driverCode || { java: defaultDriverCode },
      );
    } else {
      initialize(["java"], { java: defaultDriverCode });
    }

    getRuntimes().then((res) => {
      if (res.success && res.runtimes) {
        setAvailableRuntimes(res.runtimes);
        // Create a map of language -> first version for that language
        const versionMap: Record<string, string> = {};
        res.runtimes.forEach((rt) => {
          if (!versionMap[rt.language]) {
            versionMap[rt.language] = rt.version;
          }
        });
        setLanguageVersionMap(versionMap);
      }
    });
  }, [initialData, initialize]);

  // Initialize verify code map from driver code map when language changes
  useEffect(() => {
    if (!verifyCodeMap[verifyTabLang]) {
      setVerifyCodeMap((prev) => ({
        ...prev,
        [verifyTabLang]: driverCodeMap[verifyTabLang] || "",
      }));
    }
  }, [verifyTabLang, driverCodeMap, verifyCodeMap]);

  const [selectedTestCase, setSelectedTestCase] = useState(0);

  const form = useForm<ProblemFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: Bypass strict Zod types
    resolver: zodResolver(problemSchema) as any,
    defaultValues: initialData || {
      title: "",
      difficulty: "easy",
      problemStatement: "",
      driverCode: {},
      testCases: [{ input: "", expectedOutput: "", isHidden: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "testCases",
  });

  const onSubmit = async (data: ProblemFormValues) => {
    console.log("OnSubmit triggered with data:", data);
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        allowedLanguages,
        driverCode: driverCodeMap,
      };
      const res = await upsertProblem(payload);
      if (res.success) {
        toast.success("Problem saved successfully");
        router.push("/admin/problems");
      } else {
        toast.error(`Failed to save problem: ${res.error}`);
      }
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // biome-ignore lint/suspicious/noExplicitAny: Form error typing
  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
  };

  const handleVerify = useCallback(async () => {
    if (!isOnline) {
      toast.error("Turbo Server is offline. Cannot verify code.");
      return;
    }

    const code = verifyCodeMap[verifyTabLang];
    if (!code?.trim()) {
      toast.error("No driver code to run");
      return;
    }
    const currentTestCases = form.getValues("testCases");
    if (!currentTestCases || currentTestCases.length === 0) {
      toast.error("Add test cases before verifying");
      return;
    }

    setIsVerifying(true);
    setVerifyResults(null);
    try {
      const result = await runCode({
        code,
        language: verifyTabLang,
        version: languageVersionMap[verifyTabLang],
        testCases: currentTestCases.map((tc, idx) => ({
          id: String(idx),
          input: tc.input,
          expectedOutput: tc.expectedOutput,
        })),
      });

      if (result.compilationError) {
        toast.error("Compilation Error");
        setVerifyResults([
          {
            id: "error",
            passed: false,
            actualOutput: `Compilation Error:\n${result.compilationError}`,
          },
        ]);
      } else if (result.error) {
        toast.error("Execution Error");
        setVerifyResults([
          {
            id: "error",
            passed: false,
            actualOutput: `Error: ${result.error}`,
          },
        ]);
      } else if (result.results) {
        setVerifyResults(result.results);
        if (result.results.every((r) => r.passed)) {
          toast.success("All test cases passed!");
        } else {
          toast.error("Some test cases failed");
        }
      }
    } catch {
      toast.error("Failed to execute code");
    } finally {
      setIsVerifying(false);
    }
  }, [verifyCodeMap, verifyTabLang, form, isOnline, languageVersionMap]);

  // Ensure selectedTestCase is in bounds
  const safeIndex = selectedTestCase >= fields.length ? 0 : selectedTestCase;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-1 flex-col min-h-0 gap-4"
      >
        <Tabs defaultValue="details" className="flex flex-1 flex-col min-h-0">
          {/* Tab triggers */}
          <TabsList className="shrink-0 w-fit">
            <TabsTrigger value="details" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" />
              Driver Code
            </TabsTrigger>
            <TabsTrigger value="tests" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Test Cases
              {fields.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 text-[10px]"
                >
                  {fields.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verify" className="gap-1.5">
              <Play className="h-3.5 w-3.5" />
              Verify
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab: Details ─── */}
          <TabsContent
            value="details"
            className="flex-1 flex flex-col min-h-0 mt-4 gap-4"
          >
            {/* Title + Difficulty row */}
            <div className="grid gap-4 md:grid-cols-2 shrink-0">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Two Sum" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Problem Statement + Preview — fills remaining space */}
            <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col min-h-0 space-y-2">
                <FormLabel className="shrink-0">
                  Problem Statement (Markdown)
                </FormLabel>
                <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                  <FormField
                    control={form.control}
                    name="problemStatement"
                    render={({ field }) => (
                      <FormItem className="h-full flex flex-col space-y-0 relative">
                        <FormControl className="h-full">
                          <Textarea
                            className="h-full google-sans w-full resize-none border-0 focus-visible:ring-0 p-4"
                            placeholder="# Problem Description..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="absolute bottom-2 left-4" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="flex flex-col min-h-0 space-y-2">
                <FormLabel className="shrink-0">Preview</FormLabel>
                <div className="flex-1 min-h-0 google-sans border rounded-md overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none bg-muted/20">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {form.watch("problemStatement") || "*No content*"}
                  </Markdown>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab: Driver Code ─── */}
          <TabsContent
            value="code"
            className="flex-1 flex flex-col min-h-0 mt-4 gap-4"
          >
            <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-[200px_1fr]">
              {/* Sidebar with language toggles */}
              <div className="flex flex-col gap-2 border rounded-md p-3 overflow-y-auto min-h-0">
                <h4 className="text-sm font-medium mb-1 shrink-0">
                  Supported Languages
                </h4>
                {availableRuntimes.length === 0 ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </div>
                ) : (
                  Array.from(
                    new Set(availableRuntimes.map((rt) => rt.language)),
                  ).map((language) => {
                    const isAllowed = allowedLanguages.includes(language);
                    const isActive = codeTabLang === language;
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: This div acts as a button to select test cases, but also contains interactive elements inside. We handle keyboard accessibility on the inner elements instead.
                      // biome-ignore lint/a11y/useKeyWithClickEvents: Same as above, we handle keyboard accessibility on the inner elements.
                      <div
                        key={language}
                        className={`flex items-center justify-between p-2 rounded-md border text-sm transition-colors cursor-pointer shrink-0 w-full text-left ${isActive ? "bg-primary/10 border-primary/30" : "hover:bg-muted"}`}
                        onClick={() => {
                          if (isAllowed || !isActive) {
                            setCodeTabLang(language);
                          }
                        }}
                      >
                        <span className="capitalize">{language}</span>
                        <Switch
                          checked={isAllowed}
                          onCheckedChange={() => {
                            toggleAllowedLanguage(language);
                            if (!isAllowed) setCodeTabLang(language);
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Code editor for active lang */}
              <div className="flex flex-col min-h-0 border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b flex items-center justify-between shrink-0">
                  <span className="text-sm font-medium capitalize">
                    {codeTabLang} Driver Code
                  </span>
                  {!allowedLanguages.includes(codeTabLang) && (
                    <Badge variant="destructive" className="h-5">
                      Not Allowed
                    </Badge>
                  )}
                </div>
                <CodeMirror
                  value={driverCodeMap[codeTabLang] || ""}
                  height="100%"
                  extensions={[
                    (languageExtensions[codeTabLang] || javascript)(),
                    EditorState.tabSize.of(4),
                  ]}
                  onChange={(value) => setDriverCode(codeTabLang, value)}
                  theme="dark"
                  style={{ flex: 1, minHeight: 0 }}
                />
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab: Test Cases ─── */}
          <TabsContent
            value="tests"
            className="flex-1 flex flex-col min-h-0 mt-4 gap-4"
          >
            {/* Header with add button */}
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-medium">Test Cases</h3>
                <p className="text-sm text-muted-foreground">
                  Define inputs and expected outputs for validation.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  append({ input: "", expectedOutput: "", isHidden: false });
                  setSelectedTestCase(fields.length);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Test Case
              </Button>
            </div>

            {/* Test case list + editor */}
            {fields.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground border rounded-md">
                No test cases yet. Click &quot;Add Test Case&quot; to create
                one.
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[220px_1fr]">
                {/* Test Case List */}
                <div className="flex flex-col gap-1 border rounded-md p-2 overflow-y-auto min-h-0">
                  {fields.map((field, index) => {
                    const isHidden = form.watch(`testCases.${index}.isHidden`);
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: This div acts as a button to select test cases, but also contains interactive elements inside. We handle keyboard accessibility on the inner elements instead.
                      // biome-ignore lint/a11y/useKeyWithClickEvents: Same as above, we handle keyboard accessibility on the inner elements.
                      <div
                        key={field.id}
                        onClick={() => setSelectedTestCase(index)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors cursor-pointer ${
                          safeIndex === index
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>Test {index + 1}</span>
                          {isHidden && (
                            <EyeOff className="h-3 w-3 opacity-60" />
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(index);
                            if (safeIndex >= fields.length - 1) {
                              setSelectedTestCase(
                                Math.max(0, fields.length - 2),
                              );
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Active Test Case Editor */}
                {fields[safeIndex] && (
                  <div className="flex flex-col gap-4 border rounded-md p-4 overflow-y-auto min-h-0">
                    <div className="flex items-center justify-between shrink-0">
                      <Badge variant="outline">
                        Test Case #{safeIndex + 1}
                      </Badge>
                      <FormField
                        control={form.control}
                        name={`testCases.${safeIndex}.isHidden`}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormLabel className="text-xs text-muted-foreground">
                              Hidden
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 flex-1 min-h-0">
                      <FormField
                        control={form.control}
                        name={`testCases.${safeIndex}.input`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col min-h-0">
                            <FormLabel className="text-xs shrink-0">
                              Input
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="flex-1 min-h-[120px] font-mono text-xs resize-none"
                                placeholder="Enter input..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`testCases.${safeIndex}.expectedOutput`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col min-h-0">
                            <FormLabel className="text-xs shrink-0">
                              Expected Output
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="flex-1 min-h-[120px] font-mono text-xs resize-none"
                                placeholder="Expected output..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── Tab: Verify ─── */}
          <TabsContent
            value="verify"
            className="flex-1 flex flex-col min-h-0 mt-4 gap-4"
          >
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-medium">Verify Solution</h3>
                <p className="text-sm text-muted-foreground">
                  Run the driver code against the defined test cases.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={verifyTabLang} onValueChange={setVerifyTabLang}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedLanguages.map((lang) => (
                      <SelectItem
                        key={lang}
                        value={lang}
                        className="capitalize"
                      >
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleVerify}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1 h-3.5 w-3.5" />
                  )}
                  Verify
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-3">
              {/* Code Editor */}
              <div className="col-span-2 flex flex-col min-h-0 border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b flex items-center shrink-0">
                  <span className="text-sm font-medium capitalize">
                    {verifyTabLang} Test Editor
                  </span>
                </div>
                <CodeMirror
                  value={verifyCodeMap[verifyTabLang] || ""}
                  height="100%"
                  extensions={[
                    (languageExtensions[verifyTabLang] || javascript)(),
                    EditorState.tabSize.of(4),
                  ]}
                  onChange={(value) =>
                    setVerifyCodeMap((prev) => ({
                      ...prev,
                      [verifyTabLang]: value,
                    }))
                  }
                  theme="dark"
                  style={{ flex: 1, minHeight: 0 }}
                />
              </div>

              {/* Results Panel */}
              <div className="flex flex-col gap-2 overflow-y-auto min-h-0 border rounded-md p-3">
                <h4 className="text-sm font-medium shrink-0">Results</h4>
                {!verifyResults ? (
                  <div className="text-sm text-muted-foreground flex-1 flex items-center justify-center">
                    Click verify to run cases...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pb-2">
                    {verifyResults.map((res, i) => (
                      <Card
                        key={res.id || i}
                        className={`border ${res.passed ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"}`}
                      >
                        <CardHeader className="py-2 px-3 border-b flex flex-row items-center justify-between space-y-0">
                          <CardTitle className="text-xs font-medium">
                            {res.id === "error"
                              ? "Execution Error"
                              : `Test Case ${Number(res.id) + 1}`}
                          </CardTitle>
                          <Badge
                            variant={res.passed ? "default" : "destructive"}
                            className="text-[10px] h-4"
                          >
                            {res.passed ? "Passed" : "Failed"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="px-3 py-2 text-xs flex flex-col gap-2">
                          {res.expectedOutput && (
                            <div>
                              <span className="font-semibold text-muted-foreground">
                                Expected:
                              </span>
                              <pre className="mt-1 font-mono">
                                {res.expectedOutput}
                              </pre>
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-muted-foreground">
                              Output:
                            </span>
                            <pre className="mt-1 font-mono text-muted-foreground">
                              {res.actualOutput || "(No output)"}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer actions — always at bottom */}
        <div className="shrink-0 flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Problem
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
