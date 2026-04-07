"use client";

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
import {
  formatLocalDateTime,
  getLocalTimeZoneId,
  getLocalTimeZoneName,
} from "@/lib/date-time";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // Stored as an ISO UTC timestamp string.
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const parseValueToDate = React.useCallback((rawValue?: string) => {
    if (!rawValue) return undefined;

    const parsed = new Date(rawValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const datePart = rawValue.split("T")[0];
    if (!datePart) return undefined;

    const fallback = new Date(`${datePart}T00:00`);
    if (!Number.isNaN(fallback.getTime())) return fallback;

    return undefined;
  }, []);

  const dateValue = React.useMemo(
    () => parseValueToDate(value),
    [parseValueToDate, value],
  );

  const getTimeFromDate = React.useCallback((date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  const timeValue = React.useMemo(() => {
    if (dateValue) return getTimeFromDate(dateValue);
    if (value?.includes("T")) return value.slice(11, 16);
    return "00:00";
  }, [dateValue, getTimeFromDate, value]);

  const updateDateWithTime = React.useCallback(
    (baseDate: Date, time: string) => {
      const [hours = 0, minutes = 0] = time.split(":").map(Number);
      const nextDate = new Date(baseDate);
      nextDate.setHours(hours, minutes, 0, 0);
      return nextDate;
    },
    [],
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const newDate = updateDateWithTime(date, timeValue);
    onChange?.(newDate.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const dateToUse = dateValue || new Date();
    const newDate = updateDateWithTime(dateToUse, time);
    onChange?.(newDate.toISOString());
  };

  const tzName = React.useMemo(() => getLocalTimeZoneName(), []);
  const tzId = React.useMemo(() => getLocalTimeZoneId(), []);

  const formattedValue = React.useMemo(() => {
    if (!dateValue) return "";
    return formatLocalDateTime(dateValue, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }, [dateValue]);

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
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {dateValue ? formattedValue || placeholder : placeholder}
          </span>
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
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          Using local timezone: {tzName || "Local"}
          {tzId ? ` (${tzId})` : ""}
        </div>
      </PopoverContent>
    </Popover>
  );
}
