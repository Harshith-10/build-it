"use client";

import { useFormContext } from "react-hook-form";
import { CollectionPicker } from "@/components/admin/exams/strategy-config/collection-picker";
import { FixedSetPicker } from "@/components/admin/exams/strategy-config/fixed-set-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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

export function StrategyConfig() {
  const form = useFormContext();
  const strategyType = form.watch("strategyType");

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader>
        <CardTitle>Question Strategy</CardTitle>
        <CardDescription>
          How questions are selected for this exam.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-y-auto space-y-6">
        <FormField
          control={form.control}
          name="strategyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Strategy Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="random_n">Random N Questions</SelectItem>
                  {/* <SelectItem value="fixed_set">Fixed Set</SelectItem> */}
                  <SelectItem value="difficulty_mix">Difficulty Mix</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <Separator />

        {strategyType === "random_n" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="strategyConfig.collectionIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Collections</FormLabel>
                  <CollectionPicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormDescription>
                    Questions will be randomly selected from these collections.
                  </FormDescription>
                </FormItem>
              )}
            />
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
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
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="strategyConfig.collectionIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Collections</FormLabel>
                  <CollectionPicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormDescription>
                    Questions will be selected from these collections based on
                    difficulty.
                  </FormDescription>
                </FormItem>
              )}
            />
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
