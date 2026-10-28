import assert from "node:assert/strict";
import {
  generateShieldItChallenge,
  verifyShieldItSignature,
  computeShieldItHmac,
  clearShieldItChallengeStore,
  OFFICIAL_EXTENSION_ID,
} from "../src/lib/shieldit/shieldit-verifier";

const TEST_SECRET = "shieldit_isolated_test_suite_key_2026";

function testGenuineVerification() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const examId = "exam_midterm_2026";

  const challenge = generateShieldItChallenge(userId, examId);
  const signature = computeShieldItHmac(
    userId,
    examId,
    challenge.nonce,
    challenge.timestamp,
    TEST_SECRET
  );

  const res = verifyShieldItSignature(
    userId,
    examId,
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: challenge.nonce,
      timestamp: challenge.timestamp,
      signature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, true, "Valid challenge and signature must pass verification");
  console.log("✔ Genuine verification passed");
}

function testRejectFakeNonce() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const examId = "exam_midterm_2026";
  const fakeNonce = "attacker_fake_nonce_123456";
  const timestamp = Date.now();
  const signature = computeShieldItHmac(
    userId,
    examId,
    fakeNonce,
    timestamp,
    TEST_SECRET
  );

  const res = verifyShieldItSignature(
    userId,
    examId,
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: fakeNonce,
      timestamp,
      signature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, false, "Fake nonce not issued by server must fail");
  assert.match(res.reason || "", /not recognized|expired|already consumed/i);
  console.log("✔ Forged nonce rejected");
}

function testRejectReplayAttack() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const examId = "exam_midterm_2026";

  const challenge = generateShieldItChallenge(userId, examId);
  const signature = computeShieldItHmac(
    userId,
    examId,
    challenge.nonce,
    challenge.timestamp,
    TEST_SECRET
  );

  const payload = {
    extensionId: OFFICIAL_EXTENSION_ID,
    version: "1.0.1",
    nonce: challenge.nonce,
    timestamp: challenge.timestamp,
    signature,
  };

  const first = verifyShieldItSignature(userId, examId, payload, { secret: TEST_SECRET });
  assert.equal(first.valid, true, "First verification should pass");

  // Replay attempt with same nonce
  const replay = verifyShieldItSignature(userId, examId, payload, { secret: TEST_SECRET });
  assert.equal(replay.valid, false, "Replayed nonce must be rejected");
  assert.match(replay.reason || "", /already consumed/i);
  console.log("✔ Single-use anti-replay verified");
}

function testRejectCrossUserReuse() {
  clearShieldItChallengeStore();
  const examId = "exam_midterm_2026";
  const aliceChallenge = generateShieldItChallenge("usr_alice", examId);
  const bobSignature = computeShieldItHmac(
    "usr_bob",
    examId,
    aliceChallenge.nonce,
    aliceChallenge.timestamp,
    TEST_SECRET
  );

  const res = verifyShieldItSignature(
    "usr_bob",
    examId,
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: aliceChallenge.nonce,
      timestamp: aliceChallenge.timestamp,
      signature: bobSignature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, false, "Cross-user nonce reuse must fail");
  assert.match(res.reason || "", /different student account/i);
  console.log("✔ Cross-user reuse rejected");
}

function testRejectCrossExamReuse() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const exam1Challenge = generateShieldItChallenge(userId, "exam_1");
  const signature = computeShieldItHmac(
    userId,
    "exam_2",
    exam1Challenge.nonce,
    exam1Challenge.timestamp,
    TEST_SECRET
  );

  const res = verifyShieldItSignature(
    userId,
    "exam_2",
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: exam1Challenge.nonce,
      timestamp: exam1Challenge.timestamp,
      signature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, false, "Cross-exam nonce reuse must fail");
  assert.match(res.reason || "", /different examination session/i);
  console.log("✔ Cross-exam reuse rejected");
}

function testRejectTamperedSignature() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const examId = "exam_midterm_2026";
  const challenge = generateShieldItChallenge(userId, examId);
  const badSignature = "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

  const res = verifyShieldItSignature(
    userId,
    examId,
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: challenge.nonce,
      timestamp: challenge.timestamp,
      signature: badSignature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, false, "Tampered signature must be rejected");
  assert.match(res.reason || "", /Invalid cryptographic signature/i);
  console.log("✔ Tampered signature rejected");
}

function testRejectExpiredChallenge() {
  clearShieldItChallengeStore();
  const userId = "usr_alice";
  const examId = "exam_midterm_2026";
  const challenge = generateShieldItChallenge(userId, examId);
  const expiredTimestamp = Date.now() - 300_000;
  const signature = computeShieldItHmac(
    userId,
    examId,
    challenge.nonce,
    expiredTimestamp,
    TEST_SECRET
  );

  const res = verifyShieldItSignature(
    userId,
    examId,
    {
      extensionId: OFFICIAL_EXTENSION_ID,
      version: "1.0.1",
      nonce: challenge.nonce,
      timestamp: expiredTimestamp,
      signature,
    },
    { secret: TEST_SECRET }
  );

  assert.equal(res.valid, false, "Expired timestamp must fail");
  assert.match(res.reason || "", /expired/i);
  console.log("✔ Expired challenge rejected");
}

function testRejectUnofficialExtensionInProduction() {
  const env = process.env as Record<string, string | undefined>;
  const originalEnv = env.NODE_ENV;
  env.NODE_ENV = "production";

  try {
    clearShieldItChallengeStore();
    const userId = "usr_alice";
    const examId = "exam_midterm_2026";
    const challenge = generateShieldItChallenge(userId, examId);
    const signature = computeShieldItHmac(
      userId,
      examId,
      challenge.nonce,
      challenge.timestamp,
      TEST_SECRET
    );

    const res = verifyShieldItSignature(
      userId,
      examId,
      {
        extensionId: "fake_untrusted_extension_id_9999",
        version: "1.0.1",
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        signature,
      },
      { secret: TEST_SECRET }
    );

    assert.equal(res.valid, false, "Unofficial extension in production must fail");
    assert.match(res.reason || "", /Unofficial extension detected/i);
    console.log("✔ Unofficial extension ID in production rejected");
  } finally {
    env.NODE_ENV = originalEnv;
  }
}

function runAll() {
  console.log("Running ShieldIt Security Integration Tests...\n");
  testGenuineVerification();
  testRejectFakeNonce();
  testRejectReplayAttack();
  testRejectCrossUserReuse();
  testRejectCrossExamReuse();
  testRejectTamperedSignature();
  testRejectExpiredChallenge();
  testRejectUnofficialExtensionInProduction();
  console.log("\nAll 8 ShieldIt Security Tests Passed Successfully! 🎉");
}

runAll();
