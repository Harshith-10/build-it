"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ExamDataPoint {
  name: string;
  title: string;
  date: string;
  score: number;
  status: "completed" | "unattempted";
  scoreText: string;
}

interface PerformanceChartProps {
  data: ExamDataPoint[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Score percentage per individual exam
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as ExamDataPoint;

              return (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 text-xs text-[var(--card-foreground)] shadow-md max-w-xs space-y-1">
                  <p className="font-semibold text-foreground break-words">
                    {item.title}
                  </p>
                  <p className="text-muted-foreground">{item.date}</p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="font-bold">Score:</span>
                    <span>{item.scoreText}</span>
                  </div>
                  {item.status === "unattempted" && (
                    <span className="inline-block mt-1 text-[11px] text-amber-500 font-medium">
                      Unattempted (0%)
                    </span>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "var(--primary)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
