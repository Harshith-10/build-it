"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { upsertExam } from "@/actions/admin/exams";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentsList } from "./form-sections/assignments-list";
import { BasicDetails } from "./form-sections/basic-details";
import { GradingConfig } from "./form-sections/grading-config";
import { StrategyConfig } from "./form-sections/strategy-config";

const examSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  startTime: z.string(), // datetime-local string
  endTime: z.string(),
  duration: z.coerce.number().min(1),

  strategyType: z.enum(["random_n", "fixed_set", "difficulty_mix"]),
  strategyConfig: z.any(), // Refined based on type in UI

  gradingStrategy: z.enum(["linear", "difficulty_based", "count_based"]),
  gradingConfig: z.any(),

  assignments: z
    .array(
      z.object({
        groupId: z.string(),
        groupName: z.string().optional(), // For UI display
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        requiresPin: z.boolean().default(false),
        pinCode: z.string().optional().nullable(),
      }),
    )
    .default([]),
});

type ExamFormValues = z.infer<typeof examSchema>;

export function ExamForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExamFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: Bypass strict Zod types
    resolver: zodResolver(examSchema) as any,
    defaultValues: initialData
      ? {
          ...initialData,
          startTime: initialData.startTime
            ? new Date(initialData.startTime).toISOString()
            : "",
          endTime: initialData.endTime
            ? new Date(initialData.endTime).toISOString()
            : "",
          duration: initialData.durationMinutes || 60,
          assignments:
            initialData.groups?.map((eg: any) => ({
              groupId: eg.groupId,
              groupName: eg.group.name,
              startTime: eg.startTime
                ? new Date(eg.startTime).toISOString()
                : "",
              endTime: eg.endTime ? new Date(eg.endTime).toISOString() : "",
              requiresPin: !!eg.pin,
              pinCode: eg.pin,
            })) || [],
        }
      : {
          title: "",
          description: "",
          startTime: "",
          endTime: "",
          duration: 60,
          strategyType: "random_n",
          strategyConfig: { count: 10, collectionIds: [] },
          gradingStrategy: "linear",
          gradingConfig: { totalMarks: 100, thresholds: [] }, // Initialize with empty thresholds for safety
          assignments: [],
        },
  });

  const assignmentFieldArray = useFieldArray({
    control: form.control,
    name: "assignments",
  });

  const onSubmit = async (data: ExamFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await upsertExam(data);
      if (res.success) {
        toast.success("Exam saved successfully");
        router.push("/admin/exams");
      } else {
        toast.error(`Failed to save exam: ${res.error}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const strategyType = form.watch("strategyType");
  const gradingStrategy = form.watch("gradingStrategy");
  const strategyConfig = form.watch("strategyConfig");
  const gradingConfig = form.watch("gradingConfig");

  // Calculate Linear Marks per Question
  const linearMarksPerQuestion = (() => {
    if (gradingStrategy !== "linear") return null;
    if (strategyType === "random_n") {
      const count = strategyConfig?.count || 0;
      const total = gradingConfig?.totalMarks || 0;
      return count > 0 ? (total / count).toFixed(2) : 0;
    }
    if (strategyType === "fixed_set") {
      const count = strategyConfig?.questionIds?.length || 0;
      const total = gradingConfig?.totalMarks || 0;
      return count > 0 ? (total / count).toFixed(2) : 0;
    }
    if (strategyType === "difficulty_mix") {
      const count =
        (strategyConfig?.easy || 0) +
        (strategyConfig?.medium || 0) +
        (strategyConfig?.hard || 0);
      const total = gradingConfig?.totalMarks || 0;
      return count > 0 ? (total / count).toFixed(2) : 0;
    }
    return 0;
  })();

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col h-full w-full min-h-0"
      >
        <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <TabsList>
              <TabsTrigger value="basic">Basic Details</TabsTrigger>
              <TabsTrigger value="strategy">Strategy</TabsTrigger>
              <TabsTrigger value="grading">Grading</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
            </TabsList>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Exam
            </Button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsContent
              value="basic"
              className="mt-0 h-full flex flex-col data-[state=inactive]:hidden"
            >
              <BasicDetails form={form} />
            </TabsContent>

            <TabsContent
              value="strategy"
              className="mt-0 h-full flex flex-col data-[state=inactive]:hidden"
            >
              <StrategyConfig />
            </TabsContent>

            <TabsContent
              value="grading"
              className="mt-0 h-full flex flex-col data-[state=inactive]:hidden"
            >
              <GradingConfig linearMarksPerQuestion={linearMarksPerQuestion} />
            </TabsContent>

            <TabsContent
              value="assignments"
              className="mt-0 h-full flex flex-col data-[state=inactive]:hidden"
            >
              <AssignmentsList form={form} fieldArray={assignmentFieldArray} />
            </TabsContent>
          </div>
        </Tabs>
      </form>
    </Form>
  );
}
