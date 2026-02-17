"use client";

import { format, parse } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // datetime-local format: "YYYY-MM-DDTHH:mm"
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const dateValue = value ? new Date(value) : undefined;
  const timeValue = value ? value.slice(11, 16) : "00:00";

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const time = timeValue || "00:00";
    const iso = format(date, "yyyy-MM-dd") + "T" + time;
    onChange?.(iso);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    if (!dateValue) {
      const today = format(new Date(), "yyyy-MM-dd");
      onChange?.(`${today}T${time}`);
    } else {
      const iso = format(dateValue, "yyyy-MM-dd") + "T" + time;
      onChange?.(iso);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, "PPP 'at' HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="w-auto"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
