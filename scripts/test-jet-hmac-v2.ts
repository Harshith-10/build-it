import assert from "node:assert/strict";

import { buildJetAuthHeadersV2 } from "../src/lib/jet-headers";

function assertHeadersEqual(
  actual: Record<string, string>,
  expected: Record<string, string>,
  label: string,
) {
  assert.deepEqual(actual, expected, `${label} headers mismatch`);
}

function run() {
  const postHeaders = buildJetAuthHeadersV2({
    userId: "user_123",
    keyId: "kid-2026-04",
    secret: "test_secret_32_bytes_minimum_value",
    method: "POST",
    path: "/jobs",
    body: JSON.stringify({
      language: "python",
      version: "3.12.2",
      stdin: "5\n",
    }),
    contentType: "application/json; charset=utf-8",
    nowSeconds: 1712572800,
    nonce: "00112233445566778899aabbccddeeff",
  });

  assertHeadersEqual(
    postHeaders,
    {
      "X-Jet-Auth-Version": "2",
      "X-Jet-Key-Id": "kid-2026-04",
      "X-Jet-User-Id": "user_123",
      "X-Jet-Timestamp": "1712572800",
      "X-Jet-Nonce": "00112233445566778899aabbccddeeff",
      "X-Jet-Content-SHA256":
        "b9f0bfdf3bef2c0da6b78a571debb4d1d7d7978e1bd875e5c391399ac3382f58",
      "X-Jet-Signature":
        "a10489eb62ab64f827142a2e6a282d343f314d42591c6b27d91aae998dcf614b",
    },
    "POST /jobs",
  );

  const getHeaders = buildJetAuthHeadersV2({
    userId: "user_123",
    keyId: "kid-2026-04",
    secret: "test_secret_32_bytes_minimum_value",
    method: "GET",
    path: "/jobs/job_abc123",
    query: {
      verbose: true,
      attempt: 2,
    },
    nowSeconds: 1712572800,
    nonce: "fedcba98765432100123456789abcdef",
  });

  assertHeadersEqual(
    getHeaders,
    {
      "X-Jet-Auth-Version": "2",
      "X-Jet-Key-Id": "kid-2026-04",
      "X-Jet-User-Id": "user_123",
      "X-Jet-Timestamp": "1712572800",
      "X-Jet-Nonce": "fedcba98765432100123456789abcdef",
      "X-Jet-Content-SHA256":
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "X-Jet-Signature":
        "e1fe95e4e8943b88bee5364c61bb6e44a574a443eea9956b6e41409d3812d015",
    },
    "GET /jobs/{id}",
  );

  console.log("Jet HMAC V2 conformance vectors passed.");
}

run();
