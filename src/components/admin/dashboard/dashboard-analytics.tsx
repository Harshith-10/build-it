"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Flame,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  type DashboardAnalyticsResponse,
  type Timeframe,
  getDashboardAnalytics,
} from "@/actions/admin/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const chartConfig = {
  visits: {
    label: "Total Visits",
    color: "var(--primary, #3b82f6)",
  },
  uniqueUsers: {
    label: "Unique Students",
    color: "#10b981",
  },
};

interface DashboardAnalyticsProps {
  initialData: DashboardAnalyticsResponse;
}

export function DashboardAnalytics({ initialData }: DashboardAnalyticsProps) {
  const [data, setData] = useState<DashboardAnalyticsResponse>(initialData);
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");
  const [metricMode, setMetricMode] = useState<"visits" | "uniqueUsers">("visits");
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const freshData = await getDashboardAnalytics();
        setData(freshData);
        toast.success("Analytics updated");
      } catch {
        toast.error("Failed to refresh analytics");
      }
    });
  };

  const currentTrends =
    timeframe === "today"
      ? data.trends.today
      : timeframe === "7d"
        ? data.trends.sevenDays
        : data.trends.thirtyDays;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                Platform Traffic & Visit Analytics
              </h2>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Live Telemetry
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time insights on user visits, traffic trends, and peak usage hours
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Tabs
              value={timeframe}
              onValueChange={(val) => setTimeframe(val as Timeframe)}
              className="w-auto"
            >
              <TabsList className="grid grid-cols-3 h-9">
                <TabsTrigger value="today" className="text-xs px-3">
                  Today
                </TabsTrigger>
                <TabsTrigger value="7d" className="text-xs px-3">
                  7 Days
                </TabsTrigger>
                <TabsTrigger value="30d" className="text-xs px-3">
                  30 Days
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isPending}
                  className="h-9 gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fetch latest telemetry</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* KPI Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Visits Today */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-blue-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Visits Today
              </CardTitle>
              <div className="rounded-full bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">{data.overview.visitsToday.toLocaleString()}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                {data.overview.visitsTodayChangePct >= 0 ? (
                  <span className="flex items-center font-medium text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                    +{data.overview.visitsTodayChangePct}%
                  </span>
                ) : (
                  <span className="flex items-center font-medium text-rose-600 dark:text-rose-400">
                    <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                    {data.overview.visitsTodayChangePct}%
                  </span>
                )}
                <span>vs. yesterday ({data.overview.visitsYesterday})</span>
              </div>
            </CardContent>
          </Card>

          {/* Online Users Now */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-emerald-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Online Now
              </CardTitle>
              <div className="relative flex items-center justify-center">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">{data.overview.onlineUsersNow}</div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Active in last 15 mins ({data.overview.uniqueUsersToday} unique today)
              </p>
            </CardContent>
          </Card>


          {/* Visits This Month */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-amber-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Visits This Month
              </CardTitle>
              <div className="rounded-full bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {data.overview.visitsThisMonth.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {data.overview.totalVisitsAllTime.toLocaleString()} all-time page visits
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts & Activity Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Visit Trends Chart (2 Columns) */}
          <Card className="lg:col-span-2 shadow-xs">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Visit Traffic Trend
                </CardTitle>
                <CardDescription>
                  {timeframe === "today"
                    ? "Hourly platform visits for today"
                    : timeframe === "7d"
                      ? "Daily platform visits over the last 7 days"
                      : "Daily platform visits over the last 30 days"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
                <Button
                  variant={metricMode === "visits" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setMetricMode("visits")}
                >
                  All Visits
                </Button>
                <Button
                  variant={metricMode === "uniqueUsers" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setMetricMode("uniqueUsers")}
                >
                  Unique Students
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <ChartContainer config={chartConfig} className="h-[280px] w-full min-w-0">
                {!isMounted ? (
                  <div className="h-full w-full animate-pulse rounded-lg bg-muted/20" />
                ) : currentTrends.length === 0 || currentTrends.every((t) => t.visits === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 stroke-1 text-muted-foreground/50" />
                    <p className="text-sm">No traffic recorded yet in this timeframe</p>
                    <p className="text-xs">Visits will populate as users navigate the app.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart
                      data={currentTrends}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary, #3b82f6)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--primary, #3b82f6)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        fontSize={11}
                        stroke="currentColor"
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        fontSize={11}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <RechartsTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey={metricMode}
                        stroke="var(--primary, #3b82f6)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTraffic)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Peak Hours Heatmap / Distribution (1 Column) */}
          <Card className="shadow-xs flex flex-col min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Peak Activity Hours
              </CardTitle>
              <CardDescription>
                Time of day distribution across past 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-0">
              <div className="h-[210px] w-full min-w-0">
                {!isMounted ? (
                  <div className="h-full w-full animate-pulse rounded-lg bg-muted/20" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={data.peakHours}
                      margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => (h % 4 === 0 ? `${h}h` : "")}
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        stroke="currentColor"
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background/95 p-2 shadow-md text-xs">
                                <p className="font-semibold text-foreground">{item.label}</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Visits: <span className="font-bold text-foreground">{item.visits}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="visits"
                        radius={[4, 4, 0, 0]}
                        fill="var(--primary, #3b82f6)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Peak Hour:{" "}
                  <strong className="text-foreground">
                    {data.peakHours.reduce((max, curr) => (curr.visits > max.visits ? curr : max), data.peakHours[0])?.label || "N/A"}
                  </strong>
                </span>
                <span>Total: {data.overview.visitsThisMonth} visits</span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </TooltipProvider>
  );
}
