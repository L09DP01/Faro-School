import { execSync } from "node:child_process";

console.log("=================================================");
console.log("FARO SCHOOL - COMPREHENSIVE SECURITY VERIFICATION");
console.log("=================================================\n");

const suites = [
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
