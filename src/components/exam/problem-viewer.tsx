"use client";

import { Copy, History, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSubmissions,
  type SubmissionHistoryItem,
} from "@/lib/actions/history-actions";
import { useExamStore } from "@/stores/exam-store";
import type { Question } from "./ide-shell";

interface ProblemViewerProps {
  question: Question;
  assignmentId: string;
}

export function ProblemViewer({ question, assignmentId }: ProblemViewerProps) {
  const [activeTab, setActiveTab] = useState("description");

  if (!question) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a question to view.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Tabs
        defaultValue="description"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col"
      >
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="description"
          className="flex-1 min-h-0 overflow-hidden p-0 m-0"
        >
          <ScrollArea className="h-full">
            <div className="p-6">
              <h1 className="mb-6 text-2xl font-bold">{question.title}</h1>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{question.problemStatement}</Markdown>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="submissions"
          className="flex-1 min-h-0 overflow-hidden p-0 m-0"
        >
          <SubmissionsList
            assignmentId={assignmentId}
            questionId={question.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubmissionsList({
  assignmentId,
  questionId,
}: {
  assignmentId: string;
  questionId: string;
}) {
  const { setCode } = useExamStore();
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const result = await getSubmissions(assignmentId, questionId);
      if (mounted) {
        if (result.success && result.submissions) {
          setSubmissions(result.submissions);
        } else {
          // Quietly fail or show empty state, likely no submissions found or error
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [assignmentId, questionId]);

  const handleRestore = (code: string) => {
    // Confirm restore? Maybe too annoying. Just restore.
    setCode(questionId, code);
    toast.success("Code restored to editor");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        Loading history...
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <History className="mb-2 size-8 opacity-50" />
        <p>No submissions yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {submissions.map((sub, idx) => (
          <div
            key={sub.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold capitalize ${
                      sub.verdict === "passed"
                        ? "text-green-500"
                        : sub.verdict === "failed"
                          ? "text-red-500"
                          : "text-amber-500"
                    }`}
                  >
                    {sub.verdict.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{submissions.length - idx}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleString()}
                </span>
                {sub.verdict === "failed" && (
                  <span className="text-xs text-muted-foreground">
                    {sub.testCasesPassed} passed
                  </span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => handleRestore(sub.code)}
              >
                <RefreshCcw className="size-3.5" />
                Restore
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 font-mono text-xs grid">
              <div className="max-h-[150px] overflow-auto p-3">
                <pre>{sub.code}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
