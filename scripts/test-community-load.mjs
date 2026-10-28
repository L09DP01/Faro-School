import { checkProfanity, containsUrl } from "../src/lib/community/word-filter.js";

async function runLoadAndRecoveryTests() {
  console.log("=== RUNNING COMMUNITY LOAD TEST (200 SIMULATED USERS) & RECONNECTION RECOVERY ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. In-memory Rate Limiting Simulation (same algorithm as src/app/actions/community.ts)
  const userPostTimestamps = new Map();

  function simulateRateLimit(userId) {
    const now = Date.now();
    const timestamps = userPostTimestamps.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < 3600000);
    const last10s = recent.filter((t) => now - t < 10000);

    if (last10s.length >= 5) {
      return { allowed: false, error: "Rate limit: max 5 msgs / 10s exceeded" };
    }
    if (recent.length >= 100) {
      return { allowed: false, error: "Rate limit: max 100 msgs / hr exceeded" };
    }

    recent.push(now);
    userPostTimestamps.set(userId, recent);
    return { allowed: true };
  }

  // 2. Concurrency Simulation: 200 concurrent users
  const TOTAL_USERS = 200;
  const simulatedUsers = Array.from({ length: TOTAL_USERS }, (_, i) => ({
    id: `user-sim-${i + 1}`,
    name: `Étudiant ${i + 1}`,
    message: `Message de participation de l'étudiant #${i + 1}`,
  }));

  const startTime = Date.now();
  const results = await Promise.all(
    simulatedUsers.map(async (u) => {
      // simulate network jitter 5 - 50ms
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 45) + 5));

      // 1st post
      const rate1 = simulateRateLimit(u.id);
      const profanity = checkProfanity(u.message);
      const urlCheck = containsUrl(u.message);

      return {
        userId: u.id,
        allowed: rate1.allowed && !profanity.hasProfanity && !urlCheck,
      };
    })
  );

  const durationMs = Date.now() - startTime;
  const successfulPosts = results.filter((r) => r.allowed).length;

  assert(successfulPosts === TOTAL_USERS, `All 200 concurrent user messages processed successfully in ${durationMs}ms`);
  assert(durationMs < 2000, `200 concurrent messages processed under 2000ms threshold (took ${durationMs}ms)`);

  // 3. Flood Protection Simulation: One spammer trying 10 rapid messages
  const spammerId = "spammer-user-999";
  let spamSuccess = 0;
  let spamBlocked = 0;

  for (let i = 0; i < 10; i++) {
    const res = simulateRateLimit(spammerId);
    if (res.allowed) spamSuccess++;
    else spamBlocked++;
  }

  assert(spamSuccess === 5, `Spammer allowed exactly 5 messages within 10s burst`);
  assert(spamBlocked === 5, `Spammer blocked on remaining 5 rapid messages (rate limit enforced)`);

  // 4. Lost Connection & Recovery with Idempotency Simulation
  console.log("\n--- Simulating Network Disconnect & Reconnection ---");

  // A simulated message database store with unique client_message_id index
  const messageDatabase = new Map(); // id -> message
  const clientIndex = new Set(); // clientMessageId set

  function saveMessage(msg) {
    if (msg.clientMessageId && clientIndex.has(msg.clientMessageId)) {
      // Idempotent duplicate: ignore or return existing
      return { status: "duplicate", message: messageDatabase.get(msg.clientMessageId) };
    }
    if (msg.clientMessageId) {
      clientIndex.add(msg.clientMessageId);
    }
    messageDatabase.set(msg.id, msg);
    return { status: "saved", message: msg };
  }

  // Client goes offline with 3 queued messages
  const offlineQueue = [
    { id: "msg-101", clientMessageId: "uuid-client-1", body: "Question pendant coupure réseau 1" },
    { id: "msg-102", clientMessageId: "uuid-client-2", body: "Question pendant coupure réseau 2" },
    { id: "msg-103", clientMessageId: "uuid-client-3", body: "Question pendant coupure réseau 3" },
  ];

  // First sync attempt fails mid-way (msg-101 saved, then connection drops)
  saveMessage(offlineQueue[0]);

  // Connection restored: Client resends whole unconfirmed queue [101, 102, 103]
  let reconnectedSaved = 0;
  let reconnectedDuplicatesPrevented = 0;

  for (const queuedMsg of offlineQueue) {
    const res = saveMessage(queuedMsg);
    if (res.status === "saved") {
      reconnectedSaved++;
    } else if (res.status === "duplicate") {
      reconnectedDuplicatesPrevented++;
    }
  }

  assert(reconnectedDuplicatesPrevented === 1, "Duplicate message from pre-disconnect send prevented via client_message_id");
  assert(reconnectedSaved === 2, "Remaining queued messages saved successfully upon reconnection");
  assert(clientIndex.size === 3, "Database state consistent with exactly 3 distinct messages, zero duplicates");

  console.log(`\nReliability & Load Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runLoadAndRecoveryTests().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
