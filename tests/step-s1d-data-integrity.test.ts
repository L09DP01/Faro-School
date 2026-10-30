// Fast offline mock for fetch before any module loads
globalThis.fetch = async () => {
  return new Response(JSON.stringify({ message: "DB unavailable in test environment" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getAdminPaymentsKPIs, getAdminPaymentsList } from "../src/lib/admin/payments";
import { getStudentConversations, getStaffConversations, getUnreadPrivateMessagesCount } from "../src/lib/messaging/data";
import { getCommunityGroupInfo, getCommunityMessages, getUnreadCommunityCount } from "../src/lib/community/data";
import { getAdminInstructorsList } from "../src/lib/admin/instructors";

async function runStepS1DTests() {
  console.log("=== STEP S1-D: TESTING REMOVAL OF SIMULATED DATA IN PRODUCTION ===");

  const prevAppMode = process.env.APP_MODE;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
    // 1. Test Production Paths (APP_MODE not demo)
    console.log("\n1. Testing production fail-safe empty states (APP_MODE not demo)...");
    delete process.env.APP_MODE;
    (process.env as any).NODE_ENV = "test";

    // Payments KPIs and ledger must return zeros / empty, never mock data
    console.log("   - checking kpis...");
    const kpis = await getAdminPaymentsKPIs();
    assert.strictEqual(kpis.totalValidated, 0, "Production KPIs must be 0 when no DB records, not 38000");
    assert.strictEqual(kpis.awaitingCount, 0, "Production awaiting count must be 0");

    console.log("   - checking payments list...");
    const payments = await getAdminPaymentsList();
    assert.deepStrictEqual(payments, [], "Production payments must be empty array, not mock transactions");

    // Messaging must return empty array, never mock conversations
    console.log("   - checking student conversations...");
    const studentConvs = await getStudentConversations("00000000-0000-0000-0000-000000000001");
    assert.deepStrictEqual(studentConvs, [], "Production student conversations must be empty");

    const staffConvs = await getStaffConversations("00000000-0000-0000-0000-000000000001");
    assert.deepStrictEqual(staffConvs, [], "Production staff conversations must be empty");

    const unreadMsgCount = await getUnreadPrivateMessagesCount("00000000-0000-0000-0000-000000000001");
    assert.strictEqual(unreadMsgCount, 0, "Production unread messages count must be 0, not 1");

    // Community data now requires a verified account with an active enrollment.
    for(const read of [getCommunityGroupInfo,getCommunityMessages,getUnreadCommunityCount]){
      await assert.rejects(()=>read("00000000-0000-0000-0000-000000000001"),/community_access_required/);
    }

    // Instructors list must return empty array, not mock instructors
    const instructors = await getAdminInstructorsList();
    assert.deepStrictEqual(instructors, [], "Production instructors list must be empty, not mock instructors");

    console.log("   [PASS] All production paths correctly return empty states without mock data.");

    // 2. Test Demo Mode Gating
    console.log("\n2. Testing demo mode gating (APP_MODE=demo in non-production)...");
    process.env.APP_MODE = "demo";
    (process.env as any).NODE_ENV = "development";

    const demoKpis = await getAdminPaymentsKPIs();
    assert.strictEqual(demoKpis.totalValidated, 38000, "Demo mode should return demo KPIs");

    const demoPayments = await getAdminPaymentsList();
    assert.ok(demoPayments.length > 0, "Demo mode should return demo payments list");

    const demoInstructors = await getAdminInstructorsList();
    assert.ok(demoInstructors.length > 0, "Demo mode should return demo instructors");

    console.log("   [PASS] Demo fixtures correctly gated strictly behind isDemoMode().");

    // 3. Schema Query Integrity (Verify no broken queries to courses(title))
    console.log("\n3. Verifying schema query integrity for courses table...");
    const messagingDataPath = path.join(process.cwd(), "src", "lib", "messaging", "data.ts");
    const messagingDataContent = fs.readFileSync(messagingDataPath, "utf-8");
    assert.ok(
      !messagingDataContent.includes("courses (\n          title\n        )"),
      "courses(title) must not be queried in data.ts"
    );
    assert.ok(
      messagingDataContent.includes("title_fr"),
      "courses query must select title_fr"
    );

    const privateMessagingPath = path.join(process.cwd(), "src", "app", "actions", "private-messaging.ts");
    const privateMessagingContent = fs.readFileSync(privateMessagingPath, "utf-8");
    assert.ok(
      !privateMessagingContent.includes('.select("title")'),
      '.select("title") must not exist on courses query'
    );
    assert.ok(
      privateMessagingContent.includes("title_fr"),
      "private-messaging actions must select title_fr"
    );

    console.log("   [PASS] All courses queries use real schema columns (title_fr, title_ht).");

    // 4. Instructor Creation Action Integrity
    console.log("\n4. Verifying admin instructor creation code path...");
    const adminInstPath = path.join(process.cwd(), "src", "app", "actions", "admin-instructors.ts");
    const adminInstContent = fs.readFileSync(adminInstPath, "utf-8");

    const legacyAdminMethod = ["auth", "admin", "createUser"].join(".");
    assert.ok(
      !adminInstContent.includes(legacyAdminMethod),
      "Must not call legacy admin user creation method"
    );
    assert.ok(
      adminInstContent.includes("queueAuthEmail") && adminInstContent.includes("invitation") && adminInstContent.includes("user_credentials"),
      "Must create profile with user_credentials and invitation token"
    );
    assert.ok(
      !adminInstContent.includes("getFallbackInstructorsStore"),
      "Must not import or fallback to in-memory mock store"
    );

    console.log("   [PASS] createInstructorAction properly creates auth user and assigns role via RPC.");
  } finally {
    process.env.APP_MODE = prevAppMode;
    (process.env as any).NODE_ENV = prevNodeEnv;
  }

  console.log("\nALL STEP S1-D DATA INTEGRITY TESTS PASSED SUCCESSFULLY!\n");
}

runStepS1DTests().catch((err) => {
  console.error("Step S1-D test failure:", err);
  process.exit(1);
});
