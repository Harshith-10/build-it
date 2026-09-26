import crypto from "node:crypto";

export interface ShieldItSignaturePayload {
  extensionId: string;
  version: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

export const OFFICIAL_EXTENSION_ID = "opjkppmncihahojoofiohhhlhdjpikfg";

/**
 * Safely resolves the server-side HMAC secret.
 * In production, this strictly requires the SHIELDIT_HMAC_SECRET environment variable
 * and will NEVER fallback to an insecure hardcoded secret.
 */
export function getShieldItSecret(): string {
  const secret = process.env.SHIELDIT_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SHIELDIT_HMAC_SECRET environment variable is missing in production."
      );
    }
    return "dev_local_shieldit_test_secret_only";
  }
  return secret;
}

interface ActiveChallenge {
  userId: string;
  examId?: string;
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

// In-memory challenge store bound to user + exam session
// Uses globalThis to ensure stability across module evaluations in server runtimes
const challengeStore: Map<string, ActiveChallenge> =
  (globalThis as unknown as { __shielditChallengeStore?: Map<string, ActiveChallenge> })
    .__shielditChallengeStore ||
  ((
    globalThis as unknown as { __shielditChallengeStore: Map<string, ActiveChallenge> }
  ).__shielditChallengeStore = new Map());

// Periodic cleanup of expired challenges
if (
  typeof setInterval !== "undefined" &&
  !(globalThis as unknown as { __shielditCleanupTimer?: NodeJS.Timeout })
    .__shielditCleanupTimer
) {
  (
    globalThis as unknown as { __shielditCleanupTimer: NodeJS.Timeout }
  ).__shielditCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [nonce, entry] of challengeStore.entries()) {
      if (entry.expiresAt < now) {
        challengeStore.delete(nonce);
      }
    }
  }, 60_000);
}

/**
 * Builds the canonical message string to sign and verify.
 */
export function buildShieldItCanonicalString(
  userId: string,
  examId: string,
  nonce: string,
  timestamp: number
): string {
  return `shieldit-attest-v1\n${userId}\n${examId}\n${nonce}\n${timestamp}`;
}

/**
 * Helper to generate signature (used by extension and tests).
 */
export function computeShieldItHmac(
  userId: string,
  examId: string,
  nonce: string,
  timestamp: number,
  secret?: string
): string {
  const resolvedSecret = secret ?? getShieldItSecret();
  const canonical = buildShieldItCanonicalString(userId, examId, nonce, timestamp);
  return crypto.createHmac("sha256", resolvedSecret).update(canonical, "utf8").digest("hex");
}

/**
 * Generates a short-lived random nonce and stores it server-side
 * bound to the user + exam session.
 */
export function generateShieldItChallenge(
  userId: string,
  examId?: string,
  ttlMs: number = 120_000
): { nonce: string; timestamp: number } {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();

  challengeStore.set(nonce, {
    userId,
    examId,
    nonce,
    timestamp,
    expiresAt: timestamp + ttlMs,
  });

  return { nonce, timestamp };
}

/**
 * Clears the challenge store (helper for testing).
 */
export function clearShieldItChallengeStore(): void {
  challengeStore.clear();
}

/**
 * Verifies that the incoming exam initialization request was made with a valid,
 * unexpired, server-issued challenge, signed by the extension with HMAC, and originated
 * from the official Chrome Web Store extension.
 */
export function verifyShieldItSignature(
  userId: string,
  examId: string,
  payload?: ShieldItSignaturePayload | null,
  options: {
    maxAgeMs?: number;
    strictExtensionId?: boolean;
    secret?: string;
  } = {}
): { valid: boolean; reason?: string } {
  if (!payload) {
    return {
      valid: false,
      reason: "Missing ShieldIt extension verification payload.",
    };
  }

  const { extensionId, nonce, timestamp, signature } = payload;
  const maxAgeMs = options.maxAgeMs ?? 120_000; // 2 minutes skew tolerance
  const isProduction = process.env.NODE_ENV === "production";
  const secret = options.secret ?? getShieldItSecret();

  // 1. Strict Extension ID Verification
  if (options.strictExtensionId !== false) {
    if (!extensionId) {
      return {
        valid: false,
        reason: "Extension ID is missing from verification payload.",
      };
    }

    if (isProduction) {
      if (extensionId !== OFFICIAL_EXTENSION_ID) {
        return {
          valid: false,
          reason: `Unofficial extension detected (ID: ${extensionId}). Only the official IARE ShieldIt extension is permitted.`,
        };
      }
    } else {
      if (extensionId !== OFFICIAL_EXTENSION_ID && !extensionId.startsWith("dev_")) {
        return {
          valid: false,
          reason: `Invalid extension ID: ${extensionId}.`,
        };
      }
    }
  }

  // 2. Nonce Format Validation
  if (!nonce || typeof nonce !== "string" || nonce.length < 8) {
    return {
      valid: false,
      reason: "Invalid or missing challenge nonce.",
    };
  }

  // 3. Server-bound Challenge Verification & Anti-Replay
  const storedChallenge = challengeStore.get(nonce);
  if (!storedChallenge) {
    return {
      valid: false,
      reason: "Challenge nonce not recognized, expired, or already consumed. Please retry.",
    };
  }

  // Immediately consume the nonce so it can NEVER be reused (single-use token)
  challengeStore.delete(nonce);

  // Check user binding
  if (storedChallenge.userId !== userId) {
    return {
      valid: false,
      reason: "Challenge token was issued for a different student account.",
    };
  }

  // Check exam binding
  if (storedChallenge.examId && storedChallenge.examId !== examId) {
    return {
      valid: false,
      reason: "Challenge token was issued for a different examination session.",
    };
  }

  // 4. Timestamp Freshness Check
  const now = Date.now();
  if (typeof timestamp !== "number" || Math.abs(now - timestamp) > maxAgeMs) {
    return {
      valid: false,
      reason: "ShieldIt challenge verification has expired. Please retry.",
    };
  }

  // 5. Cryptographic HMAC Signature Verification
  if (!signature || typeof signature !== "string") {
    return {
      valid: false,
      reason: "Missing cryptographic signature from extension.",
    };
  }

  const expectedSignature = computeShieldItHmac(userId, examId, nonce, timestamp, secret);

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        reason: "Invalid cryptographic signature. Tampering or spoofing detected.",
      };
    }
  } catch {
    return {
      valid: false,
      reason: "Signature verification failed.",
    };
  }

  return { valid: true };
}
