"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ExamFormInput, ExamFormValues } from "../exam-form";

interface BasicDetailsProps {
  form: UseFormReturn<ExamFormInput, unknown, ExamFormValues>;
}

export function BasicDetails({ form }: BasicDetailsProps) {
  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader>
        <CardTitle>Basic Details</CardTitle>
        <CardDescription>Basic details of the exam</CardDescription>
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
        <div className="grid grid-cols-3 gap-4">
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
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (Minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={typeof field.value === "number" ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Times are selected in your local timezone and stored as exact UTC
          timestamps.
        </p>
      </CardContent>
    </Card>
  );
}
