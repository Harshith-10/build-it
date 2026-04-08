# Next.js -> Jet HMAC V2 Signing

This document defines the current V2 request-signing contract used by Next.js when calling Jet execution surfaces.

The migration is a direct cut to V2. V1 headers are not sent by the client.

## Required Next.js Configuration

Set these server-side only environment variables in Next.js:

- `JET_SERVER_URL`: Jet base URL.
- `JET_HMAC_SECRET`: shared secret used for HMAC verification.
- `JET_HMAC_KEY_ID`: key identifier included in request headers.

Client behavior is fail-fast: execution calls throw if required HMAC variables are missing.

## Required V2 Headers

For signed requests, Next.js sends:

- `X-Jet-Auth-Version: 2`
- `X-Jet-Key-Id: <key id>`
- `X-Jet-User-Id: <stable user id>`
- `X-Jet-Timestamp: <unix seconds>`
- `X-Jet-Nonce: <hex random nonce>`
- `X-Jet-Content-SHA256: <hex sha256(body)>`
- `X-Jet-Signature: <hex hmac_sha256(secret, canonical_request)>`

## Canonical Request Format

V2 signature input is a newline-delimited canonical request string:

```text
jet-hmac-v2
{kid}
{timestamp}
{nonce}
{method}
{path}
{canonical_query}
{content_sha256}
{content_type}
{user_id}
```

Canonicalization rules:

- `method`: uppercased.
- `path`: exact request path.
- `canonical_query`: query params sorted by key then value and URI encoded.
- `content_sha256`: SHA-256 hex of UTF-8 body string; empty string hash for no body.
- `content_type`: lowercased media type without parameters.

## Endpoint Coverage

Current client signs:

- `POST /jobs`
- `GET /jobs/{id}`

This provides consistent auth posture across execution submission and polling.

## Conformance Verification

Run deterministic local vectors:

```bash
pnpm test:jet-hmac-v2
```

Script location:

- `scripts/test-jet-hmac-v2.ts`

## Security Checklist

- Keep `JET_HMAC_SECRET` server-side only.
- Rotate keys and update `JET_HMAC_KEY_ID` in lockstep with server key map.
- Keep clocks synced (NTP) on Next.js and Jet hosts.
- Use a stable, trusted user id source.
- Keep Jet behind trusted network boundaries and TLS.

## Troubleshooting

If Jet rejects signed requests:

- Verify `JET_HMAC_SECRET` and `JET_HMAC_KEY_ID` match server-side key registry.
- Verify timestamp skew tolerance and server clock sync.
- Verify canonical query/body/content-type handling is identical across client and server.
- Verify reverse proxies do not rewrite paths or strip headers.
