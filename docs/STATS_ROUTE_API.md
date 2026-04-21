# Stats Route API (Front-End Integration)

This document defines the integration contract for the Jet Server stats endpoint used by dashboards and admin UIs.

## Endpoint

- Method: `GET`
- Path: `/stats`
- Auth: none (public in current server router)
- Content-Type: `application/json`
- Success status: `200 OK`
- Rate limiting: general limiter (IP-based)

## Purpose

Use this endpoint to read server health and capacity signals:

- Uptime and host architecture
- Job throughput counters
- In-flight queue pressure
- Runtime availability summary
- Current concurrency and rate-limit configuration values

## Response Schema

```json
{
  "uptime_seconds": 3600,
  "jobs_submitted": 1024,
  "jobs_completed": 1001,
  "jobs_failed": 23,
  "jobs_in_flight": 4,
  "compile_in_flight": 1,
  "execute_in_flight": 3,
  "max_queue_depth": 1000,
  "installed_runtimes": 12,
  "supported_languages": ["cpp", "java", "python", "rust"],
  "worker_concurrency": 8,
  "compile_concurrency": 2,
  "execute_concurrency": 6,
  "max_queue_wait_secs": 30,
  "host_arch": "x86_64",
  "strict_rate_limit_token_interval_secs": 1,
  "strict_rate_limit_burst": 3,
  "general_rate_limit_token_interval_ms": 200,
  "general_rate_limit_burst": 10,
  "poll_rate_limit_token_interval_ms": 50,
  "poll_rate_limit_burst": 60
}
```

## Field Definitions

- `uptime_seconds` (`number`): Seconds since the API process started.
- `jobs_submitted` (`number`): Total jobs accepted by `POST /jobs`.
- `jobs_completed` (`number`): Total jobs that reached successful terminal state.
- `jobs_failed` (`number`): Total jobs that reached failed terminal state.
- `jobs_in_flight` (`number`): Current queued + running jobs.
- `compile_in_flight` (`number`): Current compile-stage jobs running.
- `execute_in_flight` (`number`): Current execute-stage jobs running.
- `max_queue_depth` (`number`): Configured upper bound for in-flight jobs.
- `installed_runtimes` (`number`): Count of installed runtime manifests.
- `supported_languages` (`string[]`): Languages currently available.
- `worker_concurrency` (`number`): Total worker processing slots.
- `compile_concurrency` (`number`): Compile worker slots.
- `execute_concurrency` (`number`): Execute worker slots.
- `max_queue_wait_secs` (`number`): Queue wait threshold used by server shedding logic.
- `host_arch` (`string`): Host CPU architecture (example: `x86_64`, `aarch64`).
- `strict_rate_limit_token_interval_secs` (`number`): Strict limiter token refill interval in seconds.
- `strict_rate_limit_burst` (`number`): Strict limiter burst capacity.
- `general_rate_limit_token_interval_ms` (`number`): General limiter token refill interval in milliseconds.
- `general_rate_limit_burst` (`number`): General limiter burst capacity.
- `poll_rate_limit_token_interval_ms` (`number`): Poll limiter token refill interval in milliseconds.
- `poll_rate_limit_burst` (`number`): Poll limiter burst capacity.

## Front-End TypeScript Contract

```ts
export type StatsResponse = {
  uptime_seconds: number;
  jobs_submitted: number;
  jobs_completed: number;
  jobs_failed: number;
  jobs_in_flight: number;
  compile_in_flight: number;
  execute_in_flight: number;
  max_queue_depth: number;
  installed_runtimes: number;
  supported_languages: string[];
  worker_concurrency: number;
  compile_concurrency: number;
  execute_concurrency: number;
  max_queue_wait_secs: number;
  host_arch: string;
  strict_rate_limit_token_interval_secs: number;
  strict_rate_limit_burst: number;
  general_rate_limit_token_interval_ms: number;
  general_rate_limit_burst: number;
  poll_rate_limit_token_interval_ms: number;
  poll_rate_limit_burst: number;
};
```

## Suggested Polling Strategy

- Default poll interval: `2s` to `5s`.
- Back off to `10s` to `30s` when tab is hidden.
- Use request cancellation on route unmount.
- Treat `429` as retryable with exponential backoff.

## Error Handling

Current implementation returns JSON body only on success. For non-200 responses, treat body as opaque text unless a gateway layer enforces a JSON envelope.

Recommended client behavior:

- `429`: retry with backoff and jitter.
- `5xx`: show degraded-state banner and continue polling with longer interval.
- Network error: offline/disconnected UI state.

## Example Fetch

```ts
async function fetchStats(baseUrl: string): Promise<StatsResponse> {
  const res = await fetch(`${baseUrl}/stats`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return (await res.json()) as StatsResponse;
}
```

## Notes

- Values are point-in-time counters/gauges and can change between polls.
- `supported_languages` is returned sorted by the server.
- If schema evolves, front-end should ignore unknown fields for forward compatibility.
