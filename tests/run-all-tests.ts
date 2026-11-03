import { execSync } from "node:child_process";

console.log("=================================================");
console.log("FARO SCHOOL - COMPREHENSIVE SECURITY VERIFICATION");
console.log("=================================================\n");

const suites = [
  {name:"Realtime token refresh and logout fencing",cmd:"npx tsx tests/realtime-client.test.ts"},
  {name:"Web Push RFC encryption and VAPID signatures",cmd:"npx tsx tests/web-push-crypto.test.ts"},
  {name:"Live private delivery and Push SQL authorization",cmd:"npx tsx tests/live-message-push-sql.test.ts"},
  {name:"Device Push API validation and ownership",cmd:"npx tsx tests/message-push-api.test.ts"},
  {name:"Push dispatch leases, read suppression and retries",cmd:"npx tsx tests/message-push-dispatch.test.ts"},
  {name:"PWA Push notification and safe click",cmd:"npx tsx tests/message-push-worker.test.ts"},
  {name:"Support ticket terminal resolution and preserved history",cmd:"npx tsx tests/support-ticket-closure.test.ts"},
  {name:"Logout session cookies and safe login redirect",cmd:"npx tsx tests/logout-account.test.ts"},
  {name:"Support source provenance across deployment platforms",cmd:"npx tsx tests/support-provenance.test.ts"},
  {name:"Support multi-turn orchestration and human transfer",cmd:"npx tsx tests/support-flow.test.ts"},
  {name:"Support own-account tool authorization",cmd:"npx tsx tests/support-tools.test.ts"},
  {name:"Support provider data minimization contract",cmd:"npx tsx tests/support-provider-contract.test.ts"},
  {name:"Support knowledge SQL and generation fencing",cmd:"npx tsx tests/support-knowledge.test.ts"},
  {name:"Support contextual intent and private facts",cmd:"npx tsx tests/support-reasoning.test.ts"},
  {name:"History reconciliation, delivery states and verified support guidance",cmd:"npx tsx tests/message-reconciliation.test.ts"},
  {name:"Presence authenticated HTTP leases",cmd:"npx tsx tests/live-presence-http.test.ts"},
  {name:"Live messaging sessions, receipts, tickets and preserved history",cmd:"npx tsx tests/live-messaging.test.ts"},
  {name:"Explicit numbered support tickets",cmd:"npx tsx tests/support-ticket.test.ts"},
  {name:"Bunny detached iframe navigation cleanup",cmd:"npx tsx tests/bunny-player-lifecycle.test.ts"},
  {name:"PWA external media never intercepted",cmd:"npx tsx tests/pwa-external-media.test.ts"},
  {name:"Bunny current player signature and access guards",cmd:"npx tsx tests/bunny-playback.test.ts"},
  {name:"Lesson resources: actual bytes and protected download",cmd:"npx tsx tests/lesson-resource.test.ts"},
  {name:"Optional lesson quizzes: private keys and server grades",cmd:"npx tsx tests/lesson-quiz.test.ts"},
  {name:"Assistant lifecycle, terminal tickets and timed chat sanctions",cmd:"npx tsx tests/assistant-lifecycle.test.ts"},
  {name:"Checkout HTTP: server price and gateway-only pending payments",cmd:"npx tsx tests/checkout-create-route.test.ts"},
  {name:"Official Kobara MonCash/NatCash webhook contract",cmd:"npx tsx tests/kobara-official-flow.test.ts"},
  {name:"Public course facts, verified reviews and own author profile",cmd:"npx tsx tests/public-course-facts.test.ts"},
  {name:"Course covers: real storage and oversized inline repair",cmd:"npx tsx tests/course-cover.test.ts"},
  {name:"Supervision bounded costs and translated states",cmd:"npx tsx tests/admin-supervision-presentation.test.ts"},
  {name:"Legacy financial reporting respects caller RLS",cmd:"npx tsx tests/admin-reporting-rls.test.ts"},
  {name:"Admin accounts/payments and real TUS video bytes",cmd:"npx tsx tests/admin-data-video.test.ts"},
  {name:"Curriculum PostgreSQL write grants and author protection",cmd:"npx tsx tests/curriculum-write-access.test.ts"},
  {name:"Moderation missing settings and database failure states",cmd:"npx tsx tests/moderation-resilience.test.ts"},
  {name:"Assistant support/course modes and private web research",cmd:"npx tsx tests/assistant-modes.test.ts"},
  {name:"Assistant messaging orchestration",cmd:"npx tsx tests/assistant-messaging-flow.test.ts"},
  {name:"Course summaries and deduplicated handoff PostgreSQL RLS",cmd:"npx tsx tests/course-ai-context.test.ts"},
  {name:"AI provider requests and actual token estimates",cmd:"npx tsx tests/admin-ai-provider.test.ts"},
  {name:"Admin real data and persisted writes",cmd:"npx tsx tests/admin-real-data.test.ts"},
  {name:"Admin messaging PostgreSQL notifications and read receipts",cmd:"npx tsx tests/admin-real-messaging.test.ts"},
  {name:"Profile language and security feedback",cmd:"npx tsx tests/profile-feedback.test.ts"},
  {name:"PWA iPhone metadata and presentation invariants",cmd:"npx tsx tests/pwa-iphone-invariants.test.ts"},
  {name:"Profile audit API corrections",cmd:"npx tsx tests/profile-audit-corrections.test.ts"},
  {name:"Profile/settings separation and exclusive navigation",cmd:"npx tsx tests/profile-settings-navigation.test.ts"},
  {name:"Login security error feedback",cmd:"npx tsx tests/login-error-feedback.test.ts"},
  {name:"Reset password FR/KR rendered states",cmd:"npx tsx tests/reset-password-copy.test.ts"},
  {name:"PWA mobile installation and logout controls",cmd:"npx tsx tests/pwa-controls.test.ts"},
  {name:"Credentials admin login and trusted IP",cmd:"npx tsx tests/auth-login-regression.test.ts"},
  {name:"Student staff selection and ticket flow",cmd:"npx tsx tests/student-messaging-flow.test.ts"},
  {name:"PWA controlled update",cmd:"npx tsx tests/pwa-update.test.ts"},
  {name:"Dashboard community actions and real unread counts",cmd:"npx tsx tests/dashboard-access.test.ts"},
  {name:"Community enrollment and Realtime RLS",cmd:"npx tsx tests/community-entitlement.test.ts"},
  {name:"Auth.js middleware cookie compatibility",cmd:"npx tsx tests/auth-middleware-session.test.ts"},
  {name:"Email Cloudflare scheduler",cmd:"npx tsx tests/email-scheduler.test.ts"},
  {name:"Email admin and cron HTTP",cmd:"npx tsx tests/email-admin-api.test.ts"},
  {name:"Email neutral HTTP handlers",cmd:"npx tsx tests/email-http.test.ts"},
  {name:"Email atomic activation",cmd:"npx tsx tests/email-activation.test.ts"},
  {name:"Email outbox and startup regressions",cmd:"npx tsx tests/email-system.test.ts"},
  {name:"Bunny and Resend: signatures, transactions and HTTP",cmd:"npx tsx tests/webhooks.test.ts"},
  {name:"Certificates: PostgreSQL rules and RLS",cmd:"npx tsx tests/certificates.test.ts"},
  {name:"Certificates: protected HTTP handlers",cmd:"npx tsx tests/certificates-api.test.ts"},
  { name: "Step S1-B: Database Roles & RLS", cmd: "npx tsx tests/db-roles-and-rls.test.ts" },
  { name: "Step S1-A: Identity & Sessions", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1a-identity.test.ts" },
  { name: "Step S1-C: Payment Integrity & Webhooks", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1c-payments.test.ts" },
  { name: "Step S1-D: Production Data & Fixture Isolation", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1d-data-integrity.test.ts" },
  { name: "Step S1-E: AI Guardrails & Governance", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1e-ai-guardrails.test.ts" },
  { name: "Step S1-F: Account Recovery & Cron Verification", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1f-audit.test.ts" },
  { name: "Step S1-G: Database Migration & Anon Table Grants", cmd: "npx tsx tests/anon-table-grants.test.ts" },
  { name: "Production Fail-Closed & Environment Validation", cmd: "npx tsx --require ./tests/setup-test-env.js tests/production-fail-closed.test.ts" },
  { name: "Full System Security & RLS Audit (66 Assertions)", cmd: "npx tsx tests/security-audit.ts" },
];

let failedCount = 0;

for (const suite of suites) {
  console.log(`\n>>> RUNNING: ${suite.name}...`);
  try {
    execSync(suite.cmd.replace(/^npx tsx /, `"${process.execPath}" node_modules/tsx/dist/cli.mjs `), { stdio: "inherit" });
    console.log(`>>> [PASSED]: ${suite.name}`);
  } catch (error) {
    failedCount++;
    console.error(`>>> [FAILED]: ${suite.name}`);
  }
}

console.log("\n=================================================");
console.log(`SUMMARY: ${suites.length - failedCount}/${suites.length} test suites passed.`);
console.log("=================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("ALL VERIFICATION SUITES COMPLETED WITH ZERO ERRORS.\n");
}
