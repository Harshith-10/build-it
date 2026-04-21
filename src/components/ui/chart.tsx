"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

function ChartContainer({
  className,
  config: _config,
  children,
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
}) {
  return (
    <div
      className={cn(
        "[&_.recharts-cartesian-axis-tick-value]:fill-foreground [&_.recharts-cartesian-axis-tick-value]:text-xs [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-tooltip-cursor]:stroke-border [&_.recharts-default-legend_text]:fill-foreground",
        "[&_.recharts-text]:fill-foreground [&_.recharts-label]:fill-foreground [&_.recharts-layer]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; color?: string }>;
  label?: string;
  className?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-background px-3 py-2 text-sm shadow-md",
        className,
      )}
    >
      {label ? (
        <div className="mb-2 text-xs text-muted-foreground">{label}</div>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || "currentColor" }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip(props: React.ComponentProps<typeof ChartTooltipContent>) {
  return <ChartTooltipContent {...props} />;
}

export type { ChartConfig };
export { ChartContainer, ChartTooltip, ChartTooltipContent };
