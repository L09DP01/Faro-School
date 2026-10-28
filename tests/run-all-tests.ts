import { execSync } from "node:child_process";

console.log("=================================================");
console.log("FARO SCHOOL - COMPREHENSIVE SECURITY VERIFICATION");
console.log("=================================================\n");

const suites = [
  { name: "Step S1-B: Database Roles & RLS", cmd: "npx tsx tests/db-roles-and-rls.test.ts" },
  { name: "Step S1-A: Identity & Sessions", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1a-identity.test.ts" },
  { name: "Step S1-C: Payment Integrity & Webhooks", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1c-payments.test.ts" },
  { name: "Step S1-D: Production Data & Fixture Isolation", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1d-data-integrity.test.ts" },
  { name: "Step S1-E: AI Guardrails & Governance", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1e-ai-guardrails.test.ts" },
  { name: "Step S1-F: Account Recovery & Cron Verification", cmd: "npx tsx --require ./tests/setup-test-env.js tests/step-s1f-audit.test.ts" },
  { name: "Full System Security & RLS Audit (66 Assertions)", cmd: "npx tsx tests/security-audit.ts" },
];

let failedCount = 0;

for (const suite of suites) {
  console.log(`\n>>> RUNNING: ${suite.name}...`);
  try {
    execSync(suite.cmd, { stdio: "inherit" });
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
