"use client";

import { formatLocalDateTime, getLocalTimeZoneName } from "@/lib/date-time";

type LocalDateTimeTextProps = {
  value: Date | string | number;
  options: Intl.DateTimeFormatOptions;
  fallback?: string;
};

export function LocalDateTimeText({
  value,
  options,
  fallback = "-",
}: LocalDateTimeTextProps) {
  const formatted = formatLocalDateTime(value, options);
  return <>{formatted || fallback}</>;
}

type LocalTimeZoneTextProps = {
  value?: Date | string | number;
  fallback?: string;
};

export function LocalTimeZoneText({
  value = new Date(),
  fallback = "",
}: LocalTimeZoneTextProps) {
  const zoneName = getLocalTimeZoneName(value);
  return <>{zoneName || fallback}</>;
}
