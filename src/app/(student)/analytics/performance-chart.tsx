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

interface ChartDataPoint {
  month: string;
  score: number;
}

interface PerformanceChartProps {
  data: ChartDataPoint[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, "Avg Score"]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#scoreGradient)"
          dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
