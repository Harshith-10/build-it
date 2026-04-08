# HMAC Header Handling Study for Jet Server Integration

## Scope

This study reviews the HMAC header handling currently implemented in:

- `src/lib/jet-headers.ts`
- `src/lib/jet.ts`

and evaluates it against general cryptographic and API-signing best practices (independent of the server's current contract/spec).

## Executive Verdict

Current implementation is **cryptographically valid but security-incomplete**.

- Good: It uses `HMAC-SHA256` correctly for the signed string it chose.
- Not good enough for robust request authentication: The signature is not bound to request method/path/body, has no nonce, and appears to be used only on one endpoint.

So the answer to "is this being done properly?" is:

- **Partially yes** for "signed identity hint".
- **No** for "strong anti-tamper, anti-replay request signing".

## What Is Implemented Today

### 1. Signature construction

From `src/lib/jet-headers.ts`, the signed payload is:

```text
{userId}\n{timestamp}
```

Then:

- Algorithm: `HMAC-SHA256`
- Output encoding: lowercase hex
- Sent headers:
  - `X-Jet-User-Id`
  - `X-Jet-Timestamp`
  - `X-Jet-Signature`

### 2. Usage

From `src/lib/jet.ts`, these headers are attached on `POST /jobs` in `submitJob(...)`.
Polling via `GET /jobs/{jobId}` does not include HMAC headers.

### 3. Secret handling in client

`JET_HMAC_SECRET` falls back to a default string:

```text
some_unsecure_default_secret
```

and only logs a warning.

## What Is Good

1. Uses standard primitive (`HMAC-SHA256`) rather than custom crypto.
2. Uses server-side env var (not browser-exposed code path in this file).
3. Includes timestamp (basic replay-window control is possible server-side).
4. Keeps signing logic centralized in a dedicated helper.

## Security Gaps and Risks

## 1) Signature does not cover request details

Signed message excludes:

- HTTP method
- request path
- query string
- body hash
- important headers

Impact:

- Signature proves "someone with secret signed this user+time" but not "this exact request".
- If an attacker can reuse the signed tuple in tolerated time, they can potentially replay/retarget requests depending on server checks.

Severity: High

## 2) No nonce/idempotency token in signed data

Timestamp alone limits replay window but does not uniquely identify a request.

Impact:

- Same signed tuple can be replayed multiple times inside the acceptance window.

Severity: High (if endpoint is state-changing)

## 3) Default insecure secret is allowed to continue

Code warns but still signs with a known, weak default.

Impact:

- Any actor knowing the fallback can forge signatures in misconfigured environments.

Severity: High in misconfigured deployments

## 4) No key identifier (`kid`) for rotation

No header indicates which shared key was used.

Impact:

- Harder zero-downtime key rotation.

Severity: Medium

## 5) Unclear canonicalization contract

Current scheme signs a simple string, which is good for simplicity, but does not define robust canonicalization for URL/body because they are not included.

Impact:

- If upgraded later without strict canonicalization, implementations may diverge.

Severity: Medium (future integration risk)

## 6) Likely incomplete endpoint coverage

Only `POST /jobs` is signed.

Impact:

- Other sensitive endpoints may be unauthenticated at message level.

Severity: Medium (depends on trust boundary and endpoint exposure)

## 7) Unknown server-side verification quality

This repository does not show Jet server verification code. Critical checks cannot be confirmed here:

- Constant-time signature compare
- strict timestamp skew rejection
- replay cache
- strict parsing and validation of headers

Severity: Unknown (potentially High)

## What "Proper" HMAC Request Signing Should Include

For strong API request authentication with shared secret, a typical modern pattern signs a canonical request string containing:

1. Algorithm/version marker
2. Key identifier (`kid`)
3. Timestamp
4. Nonce
5. HTTP method (uppercased)
6. Canonical path
7. Canonical query string
8. Content hash (SHA-256 of raw bytes)
9. Optionally selected canonical headers (`content-type`, host)

Then server verifies:

1. Header presence and format
2. Timestamp within skew window (example: +/-300s)
3. Nonce uniqueness within TTL window (replay cache)
4. Recomputed signature equals provided signature with constant-time compare
5. Optional content hash match to detect body tampering

## Recommended Header Set (V2)

Suggested headers:

- `X-Jet-Auth-Version: 2`
- `X-Jet-Key-Id: <kid>`
- `X-Jet-Timestamp: <unix-seconds>`
- `X-Jet-Nonce: <random-128-bit-or-more>`
- `X-Jet-Content-SHA256: <hex(body-sha256)>`
- `X-Jet-Signature: <hex(hmac_sha256(secret, canonical_string))>`

Optional: keep `X-Jet-User-Id` only if needed for business/rate-limit semantics, but include it in the canonical string if trusted.

## Canonical String Proposal

Use a strict line-based format (ASCII, explicit ordering):

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

Rules:

- `method`: uppercase.
- `path`: exact URL path, percent-encoding normalized once.
- `canonical_query`: sorted by key then value, RFC3986 encoded.
- `content_sha256`: hash of raw request bytes; empty body hash is SHA-256 of empty bytes.
- `content_type`: lowercase media type only (optional but consistent).
- `user_id`: exact string as sent, no trimming.

## Suggested Verification Policy

1. Reject missing/malformed required headers.
2. Enforce `abs(now - timestamp) <= tolerance`.
3. Reject nonce re-use for `(kid, nonce)` within tolerance window.
4. Recompute canonical string from received request exactly as specified.
5. Recompute HMAC and compare with constant-time function.
6. Verify content hash before parsing JSON.
7. Return uniform auth error to reduce oracle leakage.
8. Log structured reason codes internally (without leaking secret material).

## Key Management Recommendations

1. Remove insecure default secret behavior in production code.
2. Require secret presence at startup for environments where signing is enabled.
3. Use minimum 256-bit random secret.
4. Support dual-key verification during rotation (`active` + `previous`).
5. Track `kid` in logs and metrics.
6. Rotate periodically and immediately on suspicion.

## Operational Recommendations

1. Keep TLS mandatory; HMAC complements TLS, not replacement.
2. Apply HMAC to all state-changing endpoints (and any sensitive reads).
3. Add server metrics: invalid signature, stale timestamp, nonce replay, unknown kid.
4. Alert on spikes in auth failures.
5. Add conformance tests with fixed vectors and cross-language checks.

## Migration Strategy (Applied)

The migration strategy was updated from phased compatibility to direct cut:

1. Upgrade client and server together to V2.
2. Require V2 on execution submission and polling surfaces.
3. Do not accept V1 compatibility path during cutover.
4. Fail fast when V2 key material is missing.

## Implementation Status Update (2026-04-08)

- `src/lib/jet-headers.ts`
  - Upgraded to V2 canonical request signing.
  - Adds nonce, key id, content hash, and auth version headers.
- `src/lib/jet.ts`
  - Signs both POST `/jobs` and GET `/jobs/{id}`.
  - Removes insecure default secret fallback.
  - Requires `JET_HMAC_SECRET` and `JET_HMAC_KEY_ID`.
- `.github/workflows/deploy.yml`
  - Includes `JET_HMAC_KEY_ID` for build/deploy environment.
- `scripts/test-jet-hmac-v2.ts`
  - Adds deterministic V2 conformance vectors.

## Final Conclusion

The current implementation is acceptable only as a lightweight signed identity signal for rate-limiting context. It is **not** a complete request-authentication scheme by modern standards.

If your goal is robust protection against replay/tampering and stronger trust boundaries, move to a canonical request-signing design (timestamp + nonce + method/path/query/body hash + key id) and enforce strict server-side verification with constant-time compare and replay prevention.

## Reference Basis Used For This Study

- RFC 2104 (HMAC construction and key guidance)
- RFC 7518 security notes on HMAC key strength and constant-time comparison practices
- GitHub webhook signature validation guidance (constant-time compare, payload integrity, secret hygiene)
- Stripe webhook signature guidance (raw payload handling and verification pitfalls)
