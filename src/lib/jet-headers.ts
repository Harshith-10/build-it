import crypto from "node:crypto";

type JetRateLimitHeadersInput = {
  userId: string;
  secret: string;
  nowSeconds?: number;
};

export function buildJetRateLimitHeaders(
  input: JetRateLimitHeadersInput,
): Record<string, string> {
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
