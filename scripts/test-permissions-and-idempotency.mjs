import { createConversationAction, sendPrivateMessageAction } from "../src/app/actions/private-messaging.ts";
import { postMessageAction } from "../src/app/actions/community.ts";

console.log("=== RUNNING PERMISSIONS & IDEMPOTENCY UNIT TESTS ===");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  // Test 1: Instructor CANNOT start a conversation
  globalThis.__mockUser = {
    id: "inst-test-1",
    role: "instructor",
    fullName: "Formateur Test",
    email: "instructor@example.com",
  };

  const instructorRes = await createConversationAction(
    null,
    "Sujet interdit",
    "Bonjour élève"
  );
  assert(
    instructorRes.success === false &&
      instructorRes.error.includes("Les formateurs ne peuvent pas initier"),
    "Instructor cannot create conversation"
  );

  // Test 2: Admin CAN start a conversation
  globalThis.__mockUser = {
    id: "admin-test-1",
    role: "admin",
    fullName: "Admin Test",
    email: "admin@example.com",
  };

  const adminRes = await createConversationAction(
    null,
    "Support administratif",
    "Bonjour, voici des nouvelles de votre dossier.",
    "student-user-123"
  );
  if (!adminRes.success) {
    console.error("adminRes error:", adminRes.error);
  }
  assert(adminRes.success === true, "Admin can create conversation with student");

  // Test 3: Message Idempotency in Community
  globalThis.__mockUser = {
    id: "student-test-1",
    role: "student",
    fullName: "Jean Student",
    email: "jean@example.com",
  };

  const clientMsgId = "uuid-client-12345";
  const post1 = await postMessageAction("Message de test idempotence", null, null, clientMsgId);
  const post2 = await postMessageAction("Message de test idempotence", null, null, clientMsgId);

  assert(post1.success === true, "First message post succeeded");
  assert(post2.success === true, "Second message post with same clientMessageId succeeded");
  assert(post1.data.id === post2.data.id, "Second message returned the EXACT same message ID (No duplicate created)");

  // Test 4: Phone blocking in Community
  const phonePost = await postMessageAction("Rejoins-moi au +509 37 12 34 56", null, null, "client-phone-test");
  assert(
    phonePost.success === false &&
      phonePost.error.includes("numéros de téléphone"),
    "Phone number in community message was blocked with notice"
  );

  // Test 5: WhatsApp invitation blocking in Community
  const waPost = await postMessageAction("écrivez-moi sur WhatsApp s'il vous plaît", null, null, "client-wa-test");
  assert(
    waPost.success === false &&
      waPost.error.includes("WhatsApp ne sont pas autorisés"),
    "WhatsApp phrase in community message was blocked with notice"
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
