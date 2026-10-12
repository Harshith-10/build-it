"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Clock,
  Flame,
  Layers,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useState, useTransition } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardAnalyticsProps {
  initialData: DashboardAnalyticsResponse;
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

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

export function DashboardAnalytics({ initialData }: DashboardAnalyticsProps) {
  const [data, setData] = useState<DashboardAnalyticsResponse>(initialData);
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");
  const [metricMode, setMetricMode] = useState<"visits" | "uniqueUsers">("visits");
  const [isPending, startTransition] = useTransition();

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

  const currentGroups =
    timeframe === "today"
      ? data.groups.today
      : timeframe === "7d"
        ? data.groups.sevenDays
        : data.groups.thirtyDays;

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
              Real-time insights on user visits, active groups, sections, and peak usage hours
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Visits Today */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-blue-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visits Today
              </CardTitle>
              <div className="rounded-full bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.visitsToday.toLocaleString()}</div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
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
              <div className="text-2xl font-bold">{data.overview.onlineUsersNow}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active in last 15 mins ({data.overview.uniqueUsersToday} unique today)
              </p>
            </CardContent>
          </Card>

          {/* Visits This Week */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-violet-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visits This Week
              </CardTitle>
              <div className="rounded-full bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400">
                <Calendar className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.visitsThisWeek.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last 7 days total activity
              </p>
            </CardContent>
          </Card>

          {/* Visits This Month */}
          <Card className="relative overflow-hidden border bg-linear-to-br from-amber-500/10 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visits This Month
              </CardTitle>
              <div className="rounded-full bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.visitsThisMonth.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
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
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                {currentTrends.length === 0 || currentTrends.every((t) => t.visits === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 stroke-1 text-muted-foreground/50" />
                    <p className="text-sm">No traffic recorded yet in this timeframe</p>
                    <p className="text-xs">Visits will populate as users navigate the app.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
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
          <Card className="shadow-xs flex flex-col">
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
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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

        {/* Active Groups & Sections Leaderboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Groups Leaderboard with Table component (2 Columns) */}
          <Card className="lg:col-span-2 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  Active Student Groups & Batches
                </CardTitle>
                <CardDescription>
                  Ranked by student engagement and visit volume ({timeframe === "today" ? "Today" : timeframe === "7d" ? "Past 7 Days" : "Past 30 Days"})
                </CardDescription>
              </div>
              {data.overview.topGroupName && (
                <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <Flame className="h-3 w-3" /> Top: {data.overview.topGroupName}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {currentGroups.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No student groups created or assigned yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Rank</TableHead>
                      <TableHead>Group Name</TableHead>
                      <TableHead className="w-[180px]">Participation</TableHead>
                      <TableHead className="text-right w-[90px]">Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentGroups.map((group, idx) => (
                      <TableRow key={group.groupId}>
                        <TableCell>
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              idx === 0
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : idx === 1
                                  ? "bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-500/30"
                                  : idx === 2
                                    ? "bg-amber-800/20 text-amber-700 dark:text-amber-500 border border-amber-800/30"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            #{idx + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {group.groupName}
                              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                                {group.totalMembers} members
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>
                                {group.activeMembers} of {group.totalMembers} active
                              </span>
                              <span>•</span>
                              <span>Last seen {formatRelativeTime(group.lastActive)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Active</span>
                              <span className="font-semibold">{group.participationRate}%</span>
                            </div>
                            <Progress value={group.participationRate} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-sm">{group.totalVisits}</div>
                          <div className="text-[10px] text-muted-foreground">visits</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Branch & Section Distribution (1 Column) */}
          <Card className="shadow-xs flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-500" />
                Branch & Section Activity
              </CardTitle>
              <CardDescription>
                Most active departments & class sections
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 pt-0">
              {/* Branches */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Top Branches
                </div>
                {data.branches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No branch data recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.branches.slice(0, 4).map((b) => (
                      <div key={b.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{b.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] h-4.5">
                            {b.activeStudents} students
                          </Badge>
                          <span className="text-muted-foreground font-semibold">
                            {b.visitCount} visits
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sections */}
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Top Sections
                </div>
                {data.sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No section data recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.sections.slice(0, 4).map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] h-4.5">
                            {s.activeStudents} students
                          </Badge>
                          <span className="text-muted-foreground font-semibold">
                            {s.visitCount} visits
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Active Students Row with Avatar component */}
        {data.topStudents.length > 0 && (
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-500" />
                Most Active Students (Last 7 Days)
              </CardTitle>
              <CardDescription>
                Students with highest platform engagement and session volume
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.topStudents.map((student, idx) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8 text-xs font-bold bg-primary/10 text-primary">
                        <AvatarFallback>
                          {student.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{student.name}</span>
                          {idx === 0 && <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          {student.branch && <span>{student.branch}</span>}
                          {student.section && <span>- Sec {student.section}</span>}
                          {student.groupNames.length > 0 && (
                            <span className="truncate text-primary/80">
                              • {student.groupNames[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div className="text-sm font-bold text-primary">{student.visitCount}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(student.lastActive)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
