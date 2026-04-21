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
import {
  type ExamModeratorSummary,
  ModeratorsPanel,
} from "./form-sections/moderators-panel";
import { StrategyConfig } from "./form-sections/strategy-config";

const examStrategyConfigSchema = z.object({
  count: z.number().optional(),
  collectionIds: z.array(z.string()).default([]),
  questionIds: z.array(z.string()).default([]),
  easy: z.number().optional(),
  medium: z.number().optional(),
  hard: z.number().optional(),
});

const examGradingConfigSchema = z.object({
  totalMarks: z.number().optional(),
  easyWeight: z.number().optional(),
  mediumWeight: z.number().optional(),
  hardWeight: z.number().optional(),
  thresholds: z
    .array(
      z.object({
        count: z.number(),
        marks: z.number(),
      }),
    )
    .default([]),
});

const examSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  description: z.string().default(""),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.coerce.number().min(1),

  strategyType: z.enum(["random_n", "difficulty_mix"]),
  strategyConfig: examStrategyConfigSchema.default({
    collectionIds: [],
    questionIds: [],
  }),

  gradingStrategy: z.enum(["linear", "difficulty_based", "count_based"]),
  gradingConfig: examGradingConfigSchema.default({ thresholds: [] }),

  assignments: z
    .array(
      z.object({
        groupId: z.string(),
        groupName: z.string().optional(),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        requiresPin: z.boolean().default(false),
        pinCode: z.string().optional().nullable(),
      }),
    )
    .default([]),
  moderatorIds: z.array(z.string()).default([]),
});

export type ExamFormInput = z.input<typeof examSchema>;
export type ExamFormValues = z.output<typeof examSchema>;

type ExamGroupInitialData = {
  groupId: string;
  group: { name: string };
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  pin?: string | null;
};

type ExamFormInitialData = {
  id?: string;
  title?: string;
  description?: string | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  durationMinutes?: number | null;
  strategyType?: "random_n" | "difficulty_mix" | "fixed_set";
  strategyConfig?: unknown;
  gradingStrategy?: "linear" | "difficulty_based" | "count_based";
  gradingConfig?: unknown;
  assignments?: Array<{
    groupId: string;
    groupName?: string;
    startTime?: string | null;
    endTime?: string | null;
    requiresPin?: boolean;
    pinCode?: string | null;
  }>;
  groups?: ExamGroupInitialData[];
  ownerId?: string | null;
  moderatorsList?: ExamModeratorSummary[];
};

export function ExamForm({
  initialData,
  basePath = "/admin",
}: {
  initialData?: ExamFormInitialData;
  basePath?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderators, setModerators] = useState<ExamModeratorSummary[]>(
    initialData?.moderatorsList || [],
  );

  const form = useForm<ExamFormInput, unknown, ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          title: initialData.title || "",
          description: initialData.description || "",
          startTime: initialData.startTime
            ? new Date(initialData.startTime).toISOString()
            : "",
          endTime: initialData.endTime
            ? new Date(initialData.endTime).toISOString()
            : "",
          duration: initialData.durationMinutes || 60,
          strategyType:
            initialData.strategyType === "difficulty_mix"
              ? "difficulty_mix"
              : "random_n",
          strategyConfig:
            typeof initialData.strategyConfig === "object" &&
            initialData.strategyConfig !== null
              ? initialData.strategyConfig
              : { count: 10, collectionIds: [], questionIds: [] },
          gradingStrategy:
            initialData.gradingStrategy ||
            ("linear" as "linear" | "difficulty_based" | "count_based"),
          gradingConfig:
            typeof initialData.gradingConfig === "object" &&
            initialData.gradingConfig !== null
              ? initialData.gradingConfig
              : { totalMarks: 100, thresholds: [] },
          assignments:
            initialData.groups?.map((eg: ExamGroupInitialData) => ({
              groupId: eg.groupId,
              groupName: eg.group.name,
              startTime: eg.startTime
                ? new Date(eg.startTime).toISOString()
                : "",
              endTime: eg.endTime ? new Date(eg.endTime).toISOString() : "",
              requiresPin: !!eg.pin,
              pinCode: eg.pin,
            })) || [],
          moderatorIds:
            initialData.moderatorsList?.map((moderator) => moderator.id) || [],
        }
      : {
          title: "",
          description: "",
          startTime: "",
          endTime: "",
          duration: 60,
          strategyType: "random_n",
          strategyConfig: { count: 10, collectionIds: [], questionIds: [] },
          gradingStrategy: "linear",
          gradingConfig: { totalMarks: 100, thresholds: [] }, // Initialize with empty thresholds for safety
          assignments: [],
          moderatorIds: [],
        },
  });

  const assignmentFieldArray = useFieldArray({
    control: form.control,
    name: "assignments",
  });

  const onSubmit = async (data: ExamFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await upsertExam({
        ...data,
        moderatorIds: moderators.map((moderator) => moderator.id),
      });
      if (res.success) {
        toast.success("Exam saved successfully");
        router.push(`${basePath}/exams`);
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
    // if (strategyType === "fixed_set") {
    //   const count = strategyConfig?.questionIds?.length || 0;
    //   const total = gradingConfig?.totalMarks || 0;
    //   return count > 0 ? (total / count).toFixed(2) : 0;
    // }
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
              <TabsTrigger value="moderators">Moderators</TabsTrigger>
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
              <div className="space-y-4 h-full overflow-y-auto pr-1">
                <BasicDetails form={form} />
              </div>
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

            <TabsContent
              value="moderators"
              className="mt-0 h-full flex flex-col data-[state=inactive]:hidden"
            >
              <div className="h-full overflow-y-auto pr-1">
                <ModeratorsPanel
                  examId={initialData?.id}
                  ownerId={initialData?.ownerId}
                  moderators={moderators}
                  onModeratorsChange={setModerators}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </form>
    </Form>
  );
}
