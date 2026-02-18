"use client";

import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { zodResolver } from "@hookform/resolvers/zod";
import CodeMirror from "@uiw/react-codemirror";
import { EyeOff, Loader2, Play, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import * as z from "zod";
import { upsertProblem } from "@/actions/admin/problems";
import { runWithCustomInput } from "@/actions/student/exams/code-actions";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Schema
const problemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  problemStatement: z.string().min(10, "Problem statement is required"),
  driverCode: z.string().optional(),
  allowedLanguages: z.array(z.string()).default(["javascript"]),
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

const languageExtensions: Record<string, () => any> = {
  javascript: () => javascript(),
  python: () => python(),
  java: () => java(),
};

export function ProblemForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [driverLang, setDriverLang] = useState("javascript");
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState(0);

  const form = useForm<ProblemFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: Bypass strict Zod types
    resolver: zodResolver(problemSchema) as any,
    defaultValues: initialData || {
      title: "",
      difficulty: "easy",
      problemStatement: "",
      driverCode: defaultDriverCode,
      testCases: [{ input: "", expectedOutput: "", isHidden: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "testCases",
  });

  const onSubmit = async (data: ProblemFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await upsertProblem(data);
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

  const handleRunCode = useCallback(async () => {
    const code = form.getValues("driverCode");
    if (!code?.trim()) {
      toast.error("No driver code to run");
      return;
    }
    setIsRunning(true);
    setRunOutput(null);
    try {
      const result = await runWithCustomInput({
        code,
        language: driverLang,
        stdin: "",
      });
      if (result.compilationError) {
        setRunOutput(`Compilation Error:\n${result.compilationError}`);
      } else if (result.error) {
        setRunOutput(`Error: ${result.error}`);
      } else {
        setRunOutput(
          [result.stdout, result.stderr].filter(Boolean).join("\n") ||
            "(No output)",
        );
      }
    } catch {
      setRunOutput("Failed to execute code");
    } finally {
      setIsRunning(false);
    }
  }, [form, driverLang]);

  // Ensure selectedTestCase is in bounds
  const safeIndex = selectedTestCase >= fields.length ? 0 : selectedTestCase;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title + Difficulty */}
        <div className="grid gap-6 md:grid-cols-2">
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

        {/* Problem Statement + Preview */}
        <div className="grid gap-6 lg:grid-cols-2 h-[500px]">
          <div className="flex flex-col h-full space-y-2">
            <FormLabel>Problem Statement (Markdown)</FormLabel>
            <div className="flex-1 border rounded-md overflow-hidden">
              <FormField
                control={form.control}
                name="problemStatement"
                render={({ field }) => (
                  <Textarea
                    className="h-full w-full resize-none border-0 focus-visible:ring-0 p-4"
                    placeholder="# Problem Description..."
                    {...field}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex flex-col h-full space-y-2">
            <FormLabel>Preview</FormLabel>
            <div className="flex-1 border rounded-md overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none bg-muted/20">
              <Markdown remarkPlugins={[remarkGfm]}>
                {form.watch("problemStatement") || "*No content*"}
              </Markdown>
            </div>
          </div>
        </div>

        <Separator />

        {/* Driver Code with Language Selector + Run */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Driver Code</h3>
              <p className="text-sm text-muted-foreground">
                The code that wraps the user's solution and executes test cases.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={driverLang} onValueChange={setDriverLang}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleRunCode}
                disabled={isRunning}
              >
                {isRunning ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" />
                )}
                Run
              </Button>
            </div>
          </div>
          <div className="border rounded-md overflow-hidden h-[300px]">
            <FormField
              control={form.control}
              name="driverCode"
              render={({ field }) => (
                <CodeMirror
                  value={field.value}
                  height="300px"
                  extensions={[
                    (languageExtensions[driverLang] || javascript)(),
                  ]}
                  onChange={(value) => field.onChange(value)}
                  theme="dark"
                />
              )}
            />
          </div>
          {runOutput !== null && (
            <Card className="bg-muted/30">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Output
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-[150px] overflow-auto">
                  {runOutput}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Test Cases — Compact List + Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Test Cases</h3>
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

          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-md">
              No test cases yet. Click "Add Test Case" to create one.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              {/* Test Case List */}
              <div className="flex flex-col gap-1 border rounded-md p-2 max-h-[400px] overflow-auto">
                {fields.map((field, index) => {
                  const isHidden = form.watch(`testCases.${index}.isHidden`);
                  return (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => setSelectedTestCase(index)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                        safeIndex === index
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>Test {index + 1}</span>
                        {isHidden && <EyeOff className="h-3 w-3 opacity-60" />}
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
                            setSelectedTestCase(Math.max(0, fields.length - 2));
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </button>
                  );
                })}
              </div>

              {/* Active Test Case Editor */}
              {fields[safeIndex] && (
                <div className="space-y-4 border rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Test Case #{safeIndex + 1}</Badge>
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`testCases.${safeIndex}.input`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Input</FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[120px] font-mono text-xs"
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
                        <FormItem>
                          <FormLabel className="text-xs">
                            Expected Output
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[120px] font-mono text-xs"
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
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur p-4 border-t flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
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
