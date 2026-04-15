"use client";

import {
  Activity,
  AlertCircle,
  ChartLine,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Server,
  StopCircle,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import type { JetStatsResponse } from "@/types/jet-stats";

type QueueDepthResponse = {
  max_queue_depth: number | null;
};

const POLL_VISIBLE_MS = 3_000;
const POLL_HIDDEN_MS = 15_000;
const MAX_TREND_POINTS = 30;

type TrendSnapshot = {
  timestamp: number;
  jobsInFlight: number;
  compileInFlight: number;
  executeInFlight: number;
  successRate: number;
  failureRate: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function formatTrendTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function JetStatsPage() {
  const [stats, setStats] = useState<JetStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [interruptDialogOpen, setInterruptDialogOpen] = useState(false);
  const [trendHistory, setTrendHistory] = useState<TrendSnapshot[]>([]);

  // Runtime controls state
  const [queueDepth, setQueueDepth] = useState<number | null>(null);
  const [newQueueDepth, setNewQueueDepth] = useState<string>("");
  const [isLoadingQueueDepth, setIsLoadingQueueDepth] = useState(false);
  const [isSettingQueueDepth, setIsSettingQueueDepth] = useState(false);
  const [isEnablingUnlimited, setIsEnablingUnlimited] = useState(false);
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [restartOnInterrupt, setRestartOnInterrupt] = useState(false);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/jet-stats", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;

      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) {
          message = body.error;
        }
      } catch {
        // Keep fallback message when response body is not JSON.
      }

      throw new Error(message);
    }

    return (await response.json()) as JetStatsResponse;
  }, []);

  const fetchQueueDepth = useCallback(async () => {
    setIsLoadingQueueDepth(true);
    try {
      const response = await fetch("/api/admin/queue-depth", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        const message = body.error || "Failed to fetch queue depth";
        if (response.status === 401) {
          toast.error(
            "Unauthorized: You don't have permission to access runtime controls",
          );
        } else {
          toast.error(message);
        }
        return;
      }

      const data = (await response.json()) as QueueDepthResponse;
      setQueueDepth(data.max_queue_depth);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch queue depth",
      );
    } finally {
      setIsLoadingQueueDepth(false);
    }
  }, []);

  const setQueueDepthValue = useCallback(async () => {
    if (!newQueueDepth) {
      toast.error("Please enter a queue depth value");
      return;
    }

    const depth = parseInt(newQueueDepth, 10);
    if (Number.isNaN(depth) || depth < 1) {
      toast.error("Queue depth must be a positive number");
      return;
    }

    setIsSettingQueueDepth(true);
    try {
      const response = await fetch("/api/admin/queue-depth", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ max_queue_depth: depth }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        const message = body.error || "Failed to set queue depth";
        if (response.status === 401) {
          toast.error(
            "Unauthorized: You don't have permission to access runtime controls",
          );
        } else {
          toast.error(message);
        }
        return;
      }

      const data = (await response.json()) as QueueDepthResponse;
      setQueueDepth(data.max_queue_depth);
      setNewQueueDepth("");
      toast.success(`Queue depth set to ${depth}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set queue depth",
      );
    } finally {
      setIsSettingQueueDepth(false);
    }
  }, [newQueueDepth]);

  const enableUnlimitedQueueDepth = useCallback(async () => {
    setIsEnablingUnlimited(true);
    try {
      const response = await fetch("/api/admin/queue-depth", {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        const message = body.error || "Failed to enable unlimited queue depth";
        if (response.status === 401) {
          toast.error(
            "Unauthorized: You don't have permission to access runtime controls",
          );
        } else {
          toast.error(message);
        }
        return;
      }

      const data = (await response.json()) as QueueDepthResponse;
      setQueueDepth(data.max_queue_depth);
      toast.success("Queue depth set to unlimited");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to enable unlimited queue depth",
      );
    } finally {
      setIsEnablingUnlimited(false);
    }
  }, []);

  const interruptJobs = useCallback(async (restart: boolean) => {
    setIsInterrupting(true);
    try {
      const response = await fetch("/api/admin/interrupt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ restart }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        const message = body.error || "Failed to interrupt jobs";
        if (response.status === 401) {
          toast.error(
            "Unauthorized: You don't have permission to access runtime controls",
          );
        } else {
          toast.error(message);
        }
        return;
      }

      if (restart) {
        toast.success("Jobs interrupted and restart requested");
      } else {
        toast.success("Jobs interrupted successfully");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to interrupt jobs",
      );
    } finally {
      setIsInterrupting(false);
    }
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchStats(signal);
        setStats(data);
        setError(null);
        setLastUpdated(new Date());
        const submitted = Math.max(data.jobs_submitted, 1);
        setTrendHistory((previous) => {
          const nextPoint: TrendSnapshot = {
            timestamp: Date.now(),
            jobsInFlight: data.jobs_in_flight,
            compileInFlight: data.compile_in_flight,
            executeInFlight: data.execute_in_flight,
            successRate: (data.jobs_completed / submitted) * 100,
            failureRate: (data.jobs_failed / submitted) * 100,
          };

          const next = [...previous, nextPoint];
          return next.slice(-MAX_TREND_POINTS);
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchStats],
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | null = null;
    let disposed = false;

    if (!autoRefreshEnabled) {
      activeController = new AbortController();
      void refresh(activeController.signal);

      return () => {
        disposed = true;
        activeController?.abort();
      };
    }

    const poll = async () => {
      if (disposed) {
        return;
      }

      activeController?.abort();
      activeController = new AbortController();

      await refresh(activeController.signal);

      if (disposed) {
        return;
      }

      const interval = document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
      timeoutId = setTimeout(poll, interval);
    };

    const handleVisibilityChange = () => {
      if (disposed) {
        return;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      poll();
    };

    poll();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activeController?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh, autoRefreshEnabled]);

  // Load queue depth on mount
  useEffect(() => {
    void fetchQueueDepth();
  }, [fetchQueueDepth]);

  const successRate = useMemo(() => {
    if (!stats || stats.jobs_submitted === 0) {
      return null;
    }

    return (stats.jobs_completed / stats.jobs_submitted) * 100;
  }, [stats]);

  const queueUtilization = useMemo(() => {
    if (!stats || stats.max_queue_depth <= 0) {
      return null;
    }

    return Math.min((stats.jobs_in_flight / stats.max_queue_depth) * 100, 100);
  }, [stats]);

  const failureRate = useMemo(() => {
    if (!stats || stats.jobs_submitted === 0) {
      return null;
    }

    return (stats.jobs_failed / stats.jobs_submitted) * 100;
  }, [stats]);

  const overviewCards = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { label: "Uptime", value: formatUptime(stats.uptime_seconds) },
      { label: "Jobs Submitted", value: formatNumber(stats.jobs_submitted) },
      { label: "Jobs Completed", value: formatNumber(stats.jobs_completed) },
      { label: "Jobs In Flight", value: formatNumber(stats.jobs_in_flight) },
    ];
  }, [stats]);

  const systemCards = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { label: "Jobs Failed", value: formatNumber(stats.jobs_failed) },
      { label: "Jobs In Flight", value: formatNumber(stats.jobs_in_flight) },
      {
        label: "Queue Capacity",
        value: `${formatNumber(stats.jobs_in_flight)} / ${formatNumber(stats.max_queue_depth)}`,
      },
      {
        label: "Worker Concurrency",
        value: formatNumber(stats.worker_concurrency),
      },
      {
        label: "Queue Wait Threshold",
        value: `${formatNumber(stats.max_queue_wait_secs)}s`,
      },
    ];
  }, [stats]);

  const handleInterrupt = useCallback(() => {
    void interruptJobs(restartOnInterrupt);
  }, [interruptJobs, restartOnInterrupt]);

  const inFlightTrendData = useMemo(
    () =>
      trendHistory.map((point, index, points) => ({
        sampleIndex: index,
        ageAgoSeconds: Math.max(
          Math.round(
            (points[points.length - 1].timestamp - point.timestamp) / 1000,
          ),
          0,
        ),
        timestampLabel: formatTrendTime(point.timestamp),
        total: point.jobsInFlight,
        compile: point.compileInFlight,
        execute: point.executeInFlight,
      })),
    [trendHistory],
  );

  const qualityTrendData = useMemo(
    () =>
      trendHistory.map((point, index, points) => ({
        sampleIndex: index,
        ageAgoSeconds: Math.max(
          Math.round(
            (points[points.length - 1].timestamp - point.timestamp) / 1000,
          ),
          0,
        ),
        timestampLabel: formatTrendTime(point.timestamp),
        success: point.successRate,
        failure: point.failureRate,
      })),
    [trendHistory],
  );

  const inFlightMax = useMemo(() => {
    if (inFlightTrendData.length === 0) {
      return 1;
    }

    const peak = Math.max(
      ...inFlightTrendData.map((point) =>
        Math.max(point.total, point.compile, point.execute),
      ),
    );

    return Math.max(Math.ceil(peak * 1.1), 1);
  }, [inFlightTrendData]);

  const qualityMax = useMemo(() => {
    if (qualityTrendData.length === 0) {
      return 100;
    }

    const peak = Math.max(
      ...qualityTrendData.map((point) =>
        Math.max(point.success, point.failure),
      ),
    );

    return Math.max(Math.ceil(peak * 1.05), 10);
  }, [qualityTrendData]);

  const hasTrendData = trendHistory.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
      <PageHeader
        title="Jet Stats"
        description="Live Jet server throughput, runtime, and capacity metrics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1">
              <Switch
                checked={autoRefreshEnabled}
                onCheckedChange={setAutoRefreshEnabled}
                size="sm"
                aria-label="Toggle auto refresh"
              />
              <span className="text-xs text-muted-foreground">
                Auto refresh
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing || loading}
              onClick={() => {
                setIsRefreshing(true);
                void refresh();
              }}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={error ? "destructive" : "secondary"}>
            {error ? (
              <XCircle className="mr-1 h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            {error ? "Degraded" : "Live"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for first update"}
          </Badge>
          <Badge variant={autoRefreshEnabled ? "outline" : "secondary"}>
            {autoRefreshEnabled ? "Polling Active" : "Polling Paused"}
          </Badge>
        </div>

        {stats ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Compile</p>
              <p className="font-semibold">
                {formatNumber(stats.compile_in_flight)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Execute</p>
              <p className="font-semibold">
                {formatNumber(stats.execute_in_flight)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Success</p>
              <p className="font-semibold">
                {successRate === null ? "N/A" : `${successRate.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Failure</p>
              <p className="font-semibold">
                {failureRate === null ? "N/A" : `${failureRate.toFixed(1)}%`}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Jet stats unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !stats ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading live stats...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stats && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((metric) => (
              <Card key={metric.label}>
                <CardHeader className="space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">
                    {metric.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Performance Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Queue Utilization</p>
                    <p className="font-medium">
                      {queueUtilization === null
                        ? "Unlimited"
                        : `${queueUtilization.toFixed(1)}%`}
                    </p>
                  </div>
                  <Progress value={queueUtilization ?? 0} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="mt-1 text-lg font-semibold">
                      {successRate === null
                        ? "N/A"
                        : `${successRate.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">
                      Queue Wait Threshold
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(stats.max_queue_wait_secs)}s
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Compile In Flight</p>
                    <p className="mt-1 font-semibold">
                      {formatNumber(stats.compile_in_flight)}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Execute In Flight</p>
                    <p className="mt-1 font-semibold">
                      {formatNumber(stats.execute_in_flight)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Runtime Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Host Architecture
                  </span>
                  <span className="font-medium">{stats.host_arch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Installed Runtimes
                  </span>
                  <span className="font-medium">
                    {formatNumber(stats.installed_runtimes)}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">Supported Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.supported_languages.length > 0 ? (
                      stats.supported_languages.map((language) => (
                        <Badge
                          key={language}
                          variant="outline"
                          className="uppercase"
                        >
                          {language}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No languages reported
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartLine className="h-4 w-4" />
                  In-Flight Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasTrendData ? (
                  <>
                    <ChartContainer
                      config={{
                        total: { label: "Total" },
                        compile: { label: "Compile" },
                        execute: { label: "Execute" },
                      }}
                      className="h-56 rounded-md border bg-muted/20 p-2"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={inFlightTrendData}
                          margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            opacity={0.35}
                          />
                          <XAxis
                            dataKey="sampleIndex"
                            minTickGap={24}
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 11,
                            }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                            tickFormatter={(value) => {
                              const point = inFlightTrendData[Number(value)];
                              return point
                                ? `${point.ageAgoSeconds}s ago`
                                : `${Number(value)}s ago`;
                            }}
                          />
                          <YAxis
                            domain={[0, inFlightMax]}
                            tickFormatter={(value) =>
                              formatNumber(Number(value))
                            }
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 11,
                            }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                            width={46}
                          />
                          <Tooltip
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload as
                                | {
                                    ageAgoSeconds?: number;
                                    timestampLabel?: string;
                                  }
                                | undefined;
                              return item?.timestampLabel
                                ? `${item.ageAgoSeconds ?? label}s ago • ${item.timestampLabel}`
                                : `${item?.ageAgoSeconds ?? label}s ago`;
                            }}
                            formatter={(value, name) => [
                              formatNumber(Number(value ?? 0)),
                              String(name ?? ""),
                            ]}
                            content={<ChartTooltipContent />}
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total"
                            stroke="#3b82f6"
                            strokeWidth={2.4}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="compile"
                            name="Compile"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="execute"
                            name="Execute"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />{" "}
                        Total
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />{" "}
                        Compile
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-teal-500" />{" "}
                        Execute
                      </span>
                      <span className="ml-auto">
                        X-axis: oldest to newest, newest at right
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Waiting for the first refresh sample to draw trend lines.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Quality Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasTrendData ? (
                  <>
                    <ChartContainer
                      config={{
                        success: { label: "Success" },
                        failure: { label: "Failure" },
                      }}
                      className="h-56 rounded-md border bg-muted/20 p-2"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={qualityTrendData}
                          margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            opacity={0.35}
                          />
                          <XAxis
                            dataKey="sampleIndex"
                            minTickGap={24}
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 11,
                            }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                            tickFormatter={(value) => {
                              const point = qualityTrendData[Number(value)];
                              return point
                                ? `${point.ageAgoSeconds}s ago`
                                : `${Number(value)}s ago`;
                            }}
                          />
                          <YAxis
                            domain={[0, qualityMax]}
                            tickFormatter={(value) =>
                              `${Number(value).toFixed(0)}%`
                            }
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 11,
                            }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={{ stroke: "hsl(var(--border))" }}
                            width={46}
                          />
                          <Tooltip
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload as
                                | {
                                    ageAgoSeconds?: number;
                                    timestampLabel?: string;
                                  }
                                | undefined;
                              return item?.timestampLabel
                                ? `${item.ageAgoSeconds ?? label}s ago • ${item.timestampLabel}`
                                : `${item?.ageAgoSeconds ?? label}s ago`;
                            }}
                            formatter={(value, name) => [
                              `${Number(value ?? 0).toFixed(1)}%`,
                              String(name ?? ""),
                            ]}
                            content={<ChartTooltipContent />}
                          />
                          <Line
                            type="monotone"
                            dataKey="success"
                            name="Success"
                            stroke="#22c55e"
                            strokeWidth={2.4}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="failure"
                            name="Failure"
                            stroke="#ef4444"
                            strokeWidth={2.2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" />{" "}
                        Success %
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-500" />{" "}
                        Failure %
                      </span>
                      <span className="ml-auto">
                        X-axis: oldest to newest, newest at right
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Trend snapshots will appear after periodic refresh updates.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>System Capacity</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {systemCards.map((metric) => (
                  <div key={metric.label} className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiter Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Strict Limiter</p>
                  <p className="mt-1 font-semibold">
                    {stats.strict_rate_limit_burst} burst /{" "}
                    {stats.strict_rate_limit_token_interval_secs}s token
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">General Limiter</p>
                  <p className="mt-1 font-semibold">
                    {stats.general_rate_limit_burst} burst /{" "}
                    {stats.general_rate_limit_token_interval_ms}ms token
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Poll Limiter</p>
                  <p className="mt-1 font-semibold">
                    {stats.poll_rate_limit_burst} burst /{" "}
                    {stats.poll_rate_limit_token_interval_ms}ms token
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Runtime Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 font-semibold">Queue Depth Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Current mode:{" "}
                    {isLoadingQueueDepth ? (
                      "Loading..."
                    ) : queueDepth === null ? (
                      <Badge variant="outline">Unlimited</Badge>
                    ) : (
                      <Badge variant="secondary">{queueDepth} limit</Badge>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="queue-depth" className="text-xs">
                    Set Queue Depth
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="queue-depth"
                      type="number"
                      min="1"
                      placeholder="e.g., 300"
                      value={newQueueDepth}
                      onChange={(e) => setNewQueueDepth(e.target.value)}
                      disabled={isSettingQueueDepth}
                    />
                    <Button
                      size="sm"
                      disabled={isSettingQueueDepth || !newQueueDepth}
                      onClick={() => void setQueueDepthValue()}
                    >
                      {isSettingQueueDepth ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Setting...
                        </>
                      ) : (
                        "Set"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[100, 300, 1000].map((preset) => (
                    <Button
                      key={preset}
                      size="sm"
                      variant="outline"
                      disabled={isSettingQueueDepth}
                      onClick={() => setNewQueueDepth(String(preset))}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isEnablingUnlimited}
                    onClick={() => void enableUnlimitedQueueDepth()}
                  >
                    {isEnablingUnlimited ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      "Unlimited"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoadingQueueDepth}
                    onClick={() => void fetchQueueDepth()}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                <div>
                  <h3 className="mb-1 font-semibold">
                    In-Flight Job Management
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Force all in-flight jobs to fail with reason
                    <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                      interrupted_by_admin
                    </code>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                    <Switch
                      checked={restartOnInterrupt}
                      onCheckedChange={setRestartOnInterrupt}
                      size="sm"
                      disabled={isInterrupting}
                      aria-label="Restart workers after interrupt"
                    />
                    <span className="text-xs text-muted-foreground">
                      Restart after interrupt
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isInterrupting}
                    onClick={() => setInterruptDialogOpen(true)}
                  >
                    {isInterrupting ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Interrupting...
                      </>
                    ) : (
                      <>
                        <StopCircle className="mr-2 h-4 w-4" />
                        {restartOnInterrupt
                          ? "Interrupt & Restart"
                          : "Interrupt Jobs"}
                      </>
                    )}
                  </Button>
                </div>

                <AlertDialog
                  open={interruptDialogOpen}
                  onOpenChange={setInterruptDialogOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm interruption</AlertDialogTitle>
                      <AlertDialogDescription>
                        This immediately fails all running jobs. Any in-flight
                        execution will stop and be marked with
                        <span className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                          interrupted_by_admin
                        </span>
                        as the failure reason.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isInterrupting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isInterrupting}
                        onClick={() => {
                          setInterruptDialogOpen(false);
                          handleInterrupt();
                        }}
                      >
                        {restartOnInterrupt
                          ? "Interrupt & Restart"
                          : "Interrupt Jobs"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Warning: this action is immediate and affects all running
                    jobs.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-auto pb-4 flex items-center gap-1 text-xs text-muted-foreground">
        <Server className="h-3.5 w-3.5" />
        {autoRefreshEnabled
          ? "Polling every 3s (active tab) and 15s (background tab)"
          : "Auto polling paused"}
      </div>
    </div>
  );
}
