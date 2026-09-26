import crypto from "node:crypto";

export interface ShieldItSignaturePayload {
  extensionId: string;
  version: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

const DEFAULT_SECRET = process.env.SHIELDIT_HMAC_SECRET || "iare_buildit_shieldit_secure_key_2026";
export const OFFICIAL_EXTENSION_ID = "opjkppmncihahojoofiohhhlhdjpikfg";

/**
 * Constructs the canonical string for ShieldIt signature calculation.
 */
export function buildShieldItCanonicalString(
  userId: string,
  examId: string,
  nonce: string,
  timestamp: number
): string {
  return `shieldit-auth-v1\n${userId}\n${examId}\n${nonce}\n${timestamp}`;
}

/**
 * Server-side helper to sign a challenge (useful for tests or server-to-server verification).
 */
export function signShieldItChallenge(
  userId: string,
  examId: string,
  nonce: string,
  timestamp: number,
  secret: string = DEFAULT_SECRET
): string {
  const canonical = buildShieldItCanonicalString(userId, examId, nonce, timestamp);
  return crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

/**
 * Generates a short-lived random nonce and timestamp for client-side extension signing.
 */
export function generateShieldItChallenge(): { nonce: string; timestamp: number } {
  return {
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now()
  };
}

/**
 * Verifies a ShieldIt HMAC signature on the server during initializeExamSession.
 */
export function verifyShieldItSignature(
  userId: string,
  examId: string,
  payload?: ShieldItSignaturePayload | null,
  options: {
    maxAgeMs?: number;
    secret?: string;
    strictExtensionId?: boolean;
  } = {}
): { valid: boolean; reason?: string } {
  if (!payload) {
    return {
      valid: false,
      reason: "Missing ShieldIt extension cryptographic handshake payload."
    };
  }

  const { extensionId, nonce, timestamp, signature } = payload;
  const maxAgeMs = options.maxAgeMs ?? 120_000; // 2 minutes skew tolerance
  const secret = options.secret ?? DEFAULT_SECRET;

  // 1. Verify Extension ID if strict mode is enabled
  if (options.strictExtensionId !== false && extensionId) {
    if (extensionId !== OFFICIAL_EXTENSION_ID && !extensionId.startsWith("dev_")) {
      return {
        valid: false,
        reason: `Unofficial extension detected (ID: ${extensionId}). Expected official Chrome Web Store release.`
      };
    }
  }

  // 2. Verify Timestamp freshness (Anti-replay window)
  const now = Date.now();
  if (Math.abs(now - timestamp) > maxAgeMs) {
    return {
      valid: false,
      reason: "ShieldIt challenge signature has expired. Please retry."
    };
  }

  // 3. Verify Nonce structure
  if (!nonce || typeof nonce !== "string" || nonce.length < 8) {
    return {
      valid: false,
      reason: "Invalid or missing challenge nonce."
    };
  }

  // 4. Recompute HMAC and verify with constant-time equality
  const canonical = buildShieldItCanonicalString(userId, examId, nonce, timestamp);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(canonical, "utf8")
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        reason: "Invalid cryptographic signature. Tampering or spoofing detected."
      };
    }
  } catch {
    return {
      valid: false,
      reason: "Signature verification failed."
    };
  }

  return { valid: true };
}
