import crypto from "node:crypto";

type JetAuthV2HeadersInput = {
  userId: string;
  keyId: string;
  secret: string;
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: string;
  contentType?: string;
  nowSeconds?: number;
  nonce?: string;
};

function normalizeContentType(contentType?: string): string {
  if (!contentType) {
    return "";
  }
  return contentType.split(";")[0]?.trim().toLowerCase() || "";
}

function canonicalizeQuery(
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!query) {
    return "";
  }

  const items: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    items.push([key, String(value)]);
  }

  items.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1].localeCompare(b[1]);
    }
    return a[0].localeCompare(b[0]);
  });

  return items
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function buildCanonicalRequest(input: {
  keyId: string;
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  canonicalQuery: string;
  contentSha256: string;
  contentType: string;
  userId: string;
}): string {
  return [
    "jet-hmac-v2",
    input.keyId,
    input.timestamp,
    input.nonce,
    input.method,
    input.path,
    input.canonicalQuery,
    input.contentSha256,
    input.contentType,
    input.userId,
  ].join("\n");
}

export function buildJetAuthHeadersV2(
  input: JetAuthV2HeadersInput,
): Record<string, string> {
  const ts = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timestamp = String(ts);
  const nonce = input.nonce ?? crypto.randomBytes(16).toString("hex");
  const canonicalQuery = canonicalizeQuery(input.query);
  const canonicalContentType = normalizeContentType(input.contentType);
  const contentSha256 = sha256Hex(input.body ?? "");
  const canonicalRequest = buildCanonicalRequest({
    keyId: input.keyId,
    timestamp,
    nonce,
    method: input.method.toUpperCase(),
    path: input.path,
    canonicalQuery,
    contentSha256,
    contentType: canonicalContentType,
    userId: input.userId,
  });

  const signature = crypto
    .createHmac("sha256", input.secret)
    .update(canonicalRequest, "utf8")
    .digest("hex");

  return {
    "X-Jet-Auth-Version": "2",
    "X-Jet-Key-Id": input.keyId,
    "X-Jet-User-Id": input.userId,
    "X-Jet-Timestamp": timestamp,
    "X-Jet-Nonce": nonce,
    "X-Jet-Content-SHA256": contentSha256,
    "X-Jet-Signature": signature,
  };
}
