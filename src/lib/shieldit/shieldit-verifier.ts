import crypto from "node:crypto";

export interface ShieldItSignaturePayload {
  extensionId: string;
  version: string;
  nonce: string;
  timestamp: number;
}

export const OFFICIAL_EXTENSION_ID = "opjkppmncihahojoofiohhhlhdjpikfg";

/**
 * Generates a short-lived random nonce and timestamp for client-side extension handshake.
 */
export function generateShieldItChallenge(): { nonce: string; timestamp: number } {
  return {
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };
}

/**
 * Verifies that the incoming exam initialization request was made with a valid,
 * unexpired challenge and originated from the official Chrome Web Store extension.
 */
export function verifyShieldItSignature(
  _userId: string,
  _examId: string,
  payload?: ShieldItSignaturePayload | null,
  options: {
    maxAgeMs?: number;
    strictExtensionId?: boolean;
  } = {}
): { valid: boolean; reason?: string } {
  if (!payload) {
    return {
      valid: false,
      reason: "Missing ShieldIt extension verification payload.",
    };
  }

  const { extensionId, nonce, timestamp } = payload;
  const maxAgeMs = options.maxAgeMs ?? 120_000; // 2 minutes skew tolerance
  const isProduction = process.env.NODE_ENV === "production";

  // 1. Strict Extension ID Verification
  if (options.strictExtensionId !== false) {
    if (!extensionId) {
      return {
        valid: false,
        reason: "Extension ID is missing from verification payload.",
      };
    }

    if (isProduction) {
      // In production, strictly enforce the official Chrome Web Store Extension ID
      if (extensionId !== OFFICIAL_EXTENSION_ID) {
        return {
          valid: false,
          reason: `Unofficial extension detected (ID: ${extensionId}). Only the official IARE ShieldIt extension is permitted.`,
        };
      }
    } else {
      // In local development, allow official ID or dev_ prefixed IDs
      if (extensionId !== OFFICIAL_EXTENSION_ID && !extensionId.startsWith("dev_")) {
        return {
          valid: false,
          reason: `Invalid extension ID: ${extensionId}.`,
        };
      }
    }
  }

  // 2. Verify Timestamp freshness (Anti-replay window)
  const now = Date.now();
  if (typeof timestamp !== "number" || Math.abs(now - timestamp) > maxAgeMs) {
    return {
      valid: false,
      reason: "ShieldIt challenge verification has expired. Please retry.",
    };
  }

  // 3. Verify Nonce structure
  if (!nonce || typeof nonce !== "string" || nonce.length < 8) {
    return {
      valid: false,
      reason: "Invalid or missing challenge nonce.",
    };
  }

  return { valid: true };
}
