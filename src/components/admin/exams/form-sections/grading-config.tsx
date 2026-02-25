import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
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

interface GradingConfigProps {
  linearMarksPerQuestion: string | number | null;
}

export function GradingConfig({ linearMarksPerQuestion }: GradingConfigProps) {
  const form = useFormContext();
  const gradingStrategy = form.watch("gradingStrategy");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "gradingConfig.thresholds",
  });

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader>
        <CardTitle>Grading Strategy</CardTitle>
        <CardDescription>
          How scores are calculated for this exam.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-y-auto space-y-4">
        <FormField
          control={form.control}
          name="gradingStrategy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grading Logic</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="linear">Linear (Equal Weight)</SelectItem>
                  <SelectItem value="difficulty_based">
                    Difficulty Based
                  </SelectItem>
                  <SelectItem value="count_based">
                    Count Based (Thresholds)
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <Separator />

        {gradingStrategy === "linear" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="gradingConfig.totalMarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marks For Each Question</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="100"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Define marks awarded based on the number of questions solved.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ count: 1, marks: 10 })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`gradingConfig.thresholds.${index}.count`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className={index !== 0 ? "sr-only" : ""}>
                          Questions Solved
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 1"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`gradingConfig.thresholds.${index}.marks`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className={index !== 0 ? "sr-only" : ""}>
                          Marks Awarded
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 10"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    className="mb-[2px]"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4 border border-dashed rounded-md">
                  No rules defined. Click "Add Rule" to start.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
