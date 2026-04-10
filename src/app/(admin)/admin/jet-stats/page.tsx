"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JetStatsResponse } from "@/types/jet-stats";

const POLL_VISIBLE_MS = 3_000;
const POLL_HIDDEN_MS = 15_000;

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

export default function JetStatsPage() {
  const [stats, setStats] = useState<JetStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchStats(signal);
        setStats(data);
        setError(null);
        setLastUpdated(new Date());
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
  }, [refresh]);

  const successRate = useMemo(() => {
    if (!stats || stats.jobs_submitted === 0) {
      return null;
    }

    return (stats.jobs_completed / stats.jobs_submitted) * 100;
  }, [stats]);

  const metrics = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { label: "Uptime", value: formatUptime(stats.uptime_seconds) },
      { label: "Jobs Submitted", value: formatNumber(stats.jobs_submitted) },
      { label: "Jobs Completed", value: formatNumber(stats.jobs_completed) },
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

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0">
      <PageHeader
        title="Jet Stats"
        description="Live Jet server throughput, runtime, and capacity metrics"
        actions={
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
        }
      />

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Execution Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Compile In Flight</span>
                  <span className="font-medium">
                    {formatNumber(stats.compile_in_flight)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Execute In Flight</span>
                  <span className="font-medium">
                    {formatNumber(stats.execute_in_flight)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">
                    {successRate === null ? "N/A" : `${successRate.toFixed(1)}%`}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Runtime Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Host Architecture</span>
                  <span className="font-medium">{stats.host_arch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Installed Runtimes</span>
                  <span className="font-medium">
                    {formatNumber(stats.installed_runtimes)}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">Supported Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.supported_languages.length > 0 ? (
                      stats.supported_languages.map((language) => (
                        <Badge key={language} variant="outline" className="uppercase">
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

          <Card>
            <CardHeader>
              <CardTitle>Rate Limiter Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Strict Limiter</p>
                <p className="mt-1 font-medium">
                  {stats.strict_rate_limit_burst} burst / {" "}
                  {stats.strict_rate_limit_token_interval_secs}s token
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">General Limiter</p>
                <p className="mt-1 font-medium">
                  {stats.general_rate_limit_burst} burst / {" "}
                  {stats.general_rate_limit_token_interval_ms}ms token
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Poll Limiter</p>
                <p className="mt-1 font-medium">
                  {stats.poll_rate_limit_burst} burst / {" "}
                  {stats.poll_rate_limit_token_interval_ms}ms token
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-auto text-xs text-muted-foreground flex items-center gap-1">
        <Server className="h-3.5 w-3.5" />
        Polling every 3s (active tab) and 15s (background tab)
      </div>
    </div>
  );
}
