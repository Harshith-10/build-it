"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { GroupSelectionDialog } from "@/components/admin/exams/group-selection-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AssignmentsListProps {
  form: UseFormReturn<any>;
  fieldArray: UseFieldArrayReturn<any, "assignments", "id">;
}

export function AssignmentsList({ form, fieldArray }: AssignmentsListProps) {
  const { fields, append, remove } = fieldArray;
  const [openDialog, setOpenDialog] = useState(false);
  const [masterPinEnabled, setMasterPinEnabled] = useState(false);

  const generatePin = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const handleMasterPinChange = (enabled: boolean) => {
    setMasterPinEnabled(enabled);
    if (enabled) {
      const currentAssignments = form.getValues("assignments");
      const updated = currentAssignments.map((a: any) => ({
        ...a,
        requiresPin: true,
        pinCode: a.pinCode || generatePin(),
      }));
      form.setValue("assignments", updated);
    }
  };

  const handleSelectGroups = (selectedGroups: any[]) => {
    selectedGroups.forEach((group) => {
      // Check if already exists
      // biome-ignore lint/suspicious/noExplicitAny: complex form type
      if (!fields.some((f: any) => f.groupId === group.id)) {
        append({
          groupId: group.id,
          groupName: group.name,
          requiresPin: masterPinEnabled,
          pinCode: masterPinEnabled ? generatePin() : null,
        });
      }
    });
  };

  // biome-ignore lint/suspicious/noExplicitAny: complex form type
  const selectedGroupIds = fields.map((f: any) => f.groupId);

  return (
    <>
      <Card className="flex flex-col min-h-0">
        <CardHeader>
          <CardTitle>Access & Assignments</CardTitle>
          <CardDescription>Assign exam to user groups.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-y-auto space-y-4">
          <div className="flex items-center space-x-2 bg-muted/50 p-4 rounded-lg border">
            <Switch
              id="master-pin"
              checked={masterPinEnabled}
              onCheckedChange={handleMasterPinChange}
            />
            <Label
              htmlFor="master-pin"
              className="flex flex-col items-start gap-1"
            >
              <span>Enable PIN for All Groups</span>
              <span className="font-normal text-xs text-muted-foreground">
                Automatically generate PINs for all current and new groups.
              </span>
            </Label>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* biome-ignore lint/suspicious/noExplicitAny: complex form type */}
            {fields.map((field: any, index) => (
              <Card key={field.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-2xl">{field.groupName}</h4>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-4">
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
                        <FormLabel className="text-xs">Override End</FormLabel>
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
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) {
                                form.setValue(
                                  `assignments.${index}.pinCode`,
                                  generatePin(),
                                );
                              }
                            }}
                            disabled={masterPinEnabled}
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
                          <FormLabel className="text-xs">PIN Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              readOnly
                              className="font-mono bg-muted"
                              disabled
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </Card>
            ))}
            <Card
              className="min-h-70 flex items-center justify-center hover:bg-accent transition-all group cursor-pointer"
              onClick={() => setOpenDialog(true)}
            >
              <div className="flex flex-col items-center gap-2 transition-all group-hover:scale-110 group-active:scale-100">
                <PlusCircle className="h-10 w-10 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">
                  Add Group
                </span>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

      <GroupSelectionDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onSelect={handleSelectGroups}
        selectedGroupIds={selectedGroupIds}
      />
    </>
  );
}
