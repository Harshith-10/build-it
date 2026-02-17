"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { upsertExam } from "@/actions/admin/exams";
import { getGroups } from "@/actions/admin/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { FixedSetPicker } from "./strategy-config/fixed-set-picker";

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
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    getGroups({ limit: 100 }).then((res) => setGroups(res.groups));
  }, []);

  const form = useForm<ExamFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: Bypass strict Zod types
    resolver: zodResolver(examSchema) as any,
    defaultValues: initialData
      ? {
          ...initialData,
          startTime: initialData.startTime
            ? new Date(initialData.startTime).toISOString().slice(0, 16)
            : "",
          endTime: initialData.endTime
            ? new Date(initialData.endTime).toISOString().slice(0, 16)
            : "",
          assignments:
            initialData.examGroups?.map((eg: any) => ({
              groupId: eg.groupId,
              groupName: eg.group.name,
              startTime: eg.startTime
                ? new Date(eg.startTime).toISOString().slice(0, 16)
                : "",
              endTime: eg.endTime
                ? new Date(eg.endTime).toISOString().slice(0, 16)
                : "",
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
          strategyConfig: { count: 10 },
          gradingStrategy: "linear",
          gradingConfig: {},
          assignments: [],
        },
  });

  const {
    fields: assignmentFields,
    append: appendAssignment,
    remove: removeAssignment,
  } = useFieldArray({
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Steps Indicator */}
        <div className="flex justify-between items-center mb-6">
          {["Basic Details", "Strategy", "Grading", "Assignments"].map(
            (label, idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center ${step === idx + 1 ? "text-primary font-bold" : "text-muted-foreground"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 border ${step === idx + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {idx + 1}
                </div>
                <span className="text-xs">{label}</span>
              </div>
            ),
          )}
        </div>

        {/* Step 1: Basic Details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select start time"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select end time"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Strategy */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Question Strategy</CardTitle>
              <CardDescription>
                How questions are selected for this exam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="strategyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy Type</FormLabel>
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
                        <SelectItem value="random_n">
                          Random N Questions
                        </SelectItem>
                        <SelectItem value="fixed_set">Fixed Set</SelectItem>
                        <SelectItem value="difficulty_mix">
                          Difficulty Mix
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t">
                {strategyType === "random_n" && (
                  <FormField
                    control={form.control}
                    name="strategyConfig.count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Questions</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {strategyType === "fixed_set" && (
                  <FormField
                    control={form.control}
                    name="strategyConfig.questionIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Questions</FormLabel>
                        <FixedSetPicker
                          value={field.value || []}
                          onChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                )}

                {strategyType === "difficulty_mix" && (
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="strategyConfig.easy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Easy Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="strategyConfig.medium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medium Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="strategyConfig.hard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hard Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Grading */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Grading Strategy</CardTitle>
              <CardDescription>
                How scores are calculated for this exam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="gradingStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grading Logic</FormLabel>
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
                        <SelectItem value="linear">
                          Linear (Equal Weight)
                        </SelectItem>
                        <SelectItem value="difficulty_based">
                          Difficulty Based
                        </SelectItem>
                        <SelectItem value="count_based">
                          Count Based (Per Test Case)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {gradingStrategy === "linear" &&
                        "All questions are worth the same number of points."}
                      {gradingStrategy === "difficulty_based" &&
                        "Questions are weighted by difficulty level."}
                      {gradingStrategy === "count_based" &&
                        "Points are awarded per test case passed."}
                    </FormDescription>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Grading Config Fields */}
              {gradingStrategy === "linear" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="gradingConfig.totalMarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Marks</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Points are distributed equally across all questions.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {gradingStrategy === "difficulty_based" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Set the point value for each difficulty level:
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="gradingConfig.easyWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Easy (pts)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gradingConfig.mediumWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medium (pts)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="20"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gradingConfig.hardWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hard (pts)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="30"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {gradingStrategy === "count_based" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="gradingConfig.pointsPerTestCase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Points per Test Case</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="5"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Each passed test case awards this many points.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Assignments */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Access & Assignments</CardTitle>
              <CardDescription>Assign exam to user groups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Select
                  onValueChange={(val) => {
                    const group = groups.find((g) => g.id === val);
                    if (group) {
                      appendAssignment({
                        groupId: group.id,
                        groupName: group.name,
                        requiresPin: false,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Add Group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups
                      .filter(
                        (g) =>
                          !assignmentFields.some((a) => a.groupId === g.id),
                      )
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {assignmentFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{field.groupName}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAssignment(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.startTime`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Override Start
                            </FormLabel>
                            <DateTimePicker
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="Same as exam"
                            />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.endTime`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Override End
                            </FormLabel>
                            <DateTimePicker
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="Same as exam"
                            />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.requiresPin`}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 mt-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Requires PIN
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      {form.watch(`assignments.${index}.requiresPin`) && (
                        <FormField
                          control={form.control}
                          name={`assignments.${index}.pinCode`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                PIN Code
                              </FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Exam
            </Button>
          )}
        </CardFooter>
      </form>
    </Form>
  );
}
