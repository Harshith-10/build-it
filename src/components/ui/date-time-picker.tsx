"use client";

import { format } from "date-fns";
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

  let dateValue: Date | undefined = undefined;
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      dateValue = d;
    } else {
      const datePart = value.split("T")[0];
      if (datePart) {
        const fallback = new Date(`${datePart}T00:00`);
        if (!Number.isNaN(fallback.getTime())) {
          dateValue = fallback;
        }
      }
    }
  }

  const timeValue = dateValue
    ? `${dateValue.getHours().toString().padStart(2, "0")}:${dateValue.getMinutes().toString().padStart(2, "0")}`
    : value?.includes("T")
      ? value.slice(11, 16)
      : "00:00";

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hours = 0, minutes = 0] = timeValue.split(":").map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    onChange?.(newDate.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const dateToUse = dateValue || new Date();
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    const newDate = new Date(dateToUse);
    newDate.setHours(hours, minutes, 0, 0);
    onChange?.(newDate.toISOString());
  };

  const tzName = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .format(new Date())
        .split(" ")
        .pop();
    } catch {
      return "";
    }
  }, []);

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
          {dateValue
            ? `${format(dateValue, timeValue ? "PPP 'at' HH:mm" : "PPP")} ${tzName ? `(${tzName})` : ""}`
            : placeholder}
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
