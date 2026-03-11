# Next.js -> Jet Signed Rate-Limit Identity

This document defines how the Next.js server should call `jet-server` so rate limiting is applied per user instead of per proxy IP.

## Why This Exists

`jet-server` now supports a signed identity key for rate limiting:

1. If signed headers are valid, rate limits are keyed by user identity.
2. If signed headers are missing or invalid, Jet falls back to IP-based keying.

In a Server Actions architecture, falling back to IP can throttle many users together, so Next.js should always send signed identity headers.

## Required Jet Configuration

Set these on the Jet server host:

- `JET_RATE_LIMIT_HMAC_SECRET`: shared secret used to verify signatures.
- `JET_RATE_LIMIT_TIMESTAMP_TOLERANCE_SECS`: max clock skew (seconds). Default is `300`.

Use the same `JET_RATE_LIMIT_HMAC_SECRET` value on Next.js (as a server-only env var).

## Required Request Headers

For each request from Next.js to Jet:

- `X-Jet-User-Id`: stable user identifier (string).
- `X-Jet-Timestamp`: Unix epoch timestamp in seconds.
- `X-Jet-Signature`: lowercase hex HMAC-SHA256 over:

```text
{user_id}\n{timestamp}
```

Important:

- Do not include request body in the signature format above.
- Use the exact newline separator (`\n`) between user id and timestamp.
- Header names are case-insensitive on HTTP, but keep the canonical names above.

## Next.js Server Process

For each execution request:

1. Resolve authenticated user id in the server action / route handler.
2. Generate `timestamp = Math.floor(Date.now() / 1000)`.
3. Build message string: `${userId}\n${timestamp}`.
4. Compute `hmacSha256(secret, message)` and encode as lowercase hex.
5. Send request to Jet with the 3 required headers.
6. Never expose the shared secret to browser code.

## TypeScript Example (Node Runtime)

```ts
import crypto from "node:crypto";

type JetHeadersInput = {
  userId: string;
  secret: string;
  nowSeconds?: number;
};

export function buildJetRateLimitHeaders(input: JetHeadersInput): Record<string, string> {
  const ts = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timestamp = String(ts);
  const payload = `${input.userId}\n${timestamp}`;

  const signature = crypto
    .createHmac("sha256", input.secret)
    .update(payload, "utf8")
    .digest("hex");

  return {
    "X-Jet-User-Id": input.userId,
    "X-Jet-Timestamp": timestamp,
    "X-Jet-Signature": signature,
  };
}
```

## Example Server Action Usage

```ts
"use server";

import { buildJetRateLimitHeaders } from "@/lib/jet-headers";

export async function runCodeWithJet(body: unknown, userId: string) {
  const jetUrl = process.env.JET_SERVER_URL;
  const secret = process.env.JET_RATE_LIMIT_HMAC_SECRET;

  if (!jetUrl) throw new Error("JET_SERVER_URL is not set");
  if (!secret) throw new Error("JET_RATE_LIMIT_HMAC_SECRET is not set");

  const rateHeaders = buildJetRateLimitHeaders({ userId, secret });

  const res = await fetch(`${jetUrl}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...rateHeaders,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jet request failed: ${res.status} ${text}`);
  }

  return res.json();
}
```

## Security Checklist

- Keep `JET_RATE_LIMIT_HMAC_SECRET` server-side only.
- Rotate secret periodically.
- Ensure clocks are synced (NTP) on both Next.js and Jet instances.
- Use a stable user identity (do not use request-local random IDs).
- Do not allow direct public access to Jet from the internet.

## Troubleshooting

If users still get grouped by a shared limit bucket:

- Verify Next.js is always sending all 3 headers.
- Verify signatures are computed from `"{user_id}\\n{timestamp}"` exactly.
- Verify Jet and Next.js use the same secret.
- Verify timestamps are current and within tolerance.
- Confirm Jet is receiving headers unmodified by intermediate proxies.
