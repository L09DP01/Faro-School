import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { KobaraProvider } from "../src/lib/payments/kobara";
import { maskSensitiveData, maskPhoneNumber } from "../src/lib/payments/mask";

async function runStepS1CTests() {
  console.log("=== STEP S1-C: TESTING PAYMENTS HARDENING ===");

  // 1. Data Masking Tests
  console.log("\n1. Testing sensitive data and phone masking...");
  {
    const maskedPhone = maskPhoneNumber("+50937123456");
    assert.ok(maskedPhone.includes("****"), "Phone must be masked with asterisks");
    assert.strictEqual(maskedPhone.startsWith("+50"), true, "Phone start preserved");
    assert.strictEqual(maskedPhone.endsWith("56"), true, "Phone end preserved");

    const payload = {
      token: "secret_live_tok_12345",
      api_key: "kobara_sk_live_9999",
      authorization: "Bearer secret",
      password: "mySecretPassword123",
      customer: {
        phone: "+509 3800 1122",
        nestedToken: "nested_secret",
      },
      amount: 2500,
      currency: "HTG",
    };

    const sanitized = maskSensitiveData(payload);
    assert.strictEqual(sanitized.token, "[REDACTED]");
    assert.strictEqual(sanitized.api_key, "[REDACTED]");
    assert.strictEqual(sanitized.authorization, "[REDACTED]");
    assert.strictEqual(sanitized.password, "[REDACTED]");
    assert.ok(sanitized.customer.phone.includes("****"), "Customer phone masked");
    assert.strictEqual(sanitized.customer.nestedToken, "[REDACTED]");
    assert.strictEqual(sanitized.amount, 2500, "Non-sensitive data preserved");
    assert.strictEqual(sanitized.currency, "HTG", "Currency preserved");

    console.log("   [PASS] Data masking correctly strips secrets and masks phone numbers.");
  }

  // 2. Production Fail Closed Tests
  console.log("\n2. Testing production fail closed behavior (missing credentials)...");
  {
    const prevAppMode = process.env.APP_MODE;
    const prevSecret = process.env.KOBARA_SECRET_KEY;
    const prevWebhookSecret = process.env.KOBARA_WEBHOOK_SECRET;

    delete process.env.APP_MODE;
    delete process.env.KOBARA_SECRET_KEY;
    delete process.env.KOBARA_WEBHOOK_SECRET;

    try {
      const provider = new KobaraProvider();
      assert.strictEqual(provider.isMock, false, "isMock must be false when APP_MODE is not demo");

      // createPayment should throw when credentials missing
      await assert.rejects(
        async () => {
          await provider.createPayment({
            orderId: "ord-1",
            reference: "REF-1",
            amountHtg: 2500,
            courseId: "c-1",
            courseTitle: "Test Course",
            userId: "u-1",
          });
        },
        /KOBARA_SECRET_KEY is missing/,
        "Must throw if secret key is missing"
      );

      // verifyPayment should throw when credentials missing
      await assert.rejects(
        async () => {
          await provider.verifyPayment("txn_123");
        },
        /KOBARA_SECRET_KEY is missing/,
        "Must throw if secret key is missing"
      );

      // verifyWebhookSignature should throw when webhook secret is missing
      await assert.rejects(
        async () => {
          await provider.verifyWebhookSignature("raw body", "some_sig");
        },
        /KOBARA_WEBHOOK_SECRET is missing/,
        "Must throw if webhook secret is missing"
      );

      console.log("   [PASS] Production strictly fails closed without keys.");
    } finally {
      process.env.APP_MODE = prevAppMode;
      process.env.KOBARA_SECRET_KEY = prevSecret;
      process.env.KOBARA_WEBHOOK_SECRET = prevWebhookSecret;
    }
  }

  // 3. Webhook Signature & Timestamp Tolerance Tests
  console.log("\n3. Testing webhook HMAC-SHA256 signature verification & timestamp tolerance...");
  {
    const testSecret = "kbr_whsec_test_secret_998877";
    process.env.KOBARA_WEBHOOK_SECRET = testSecret;

    const provider = new KobaraProvider();
    const rawBody = JSON.stringify({
      event: "payment.succeeded",
      data: {
        id: "txn_kobara_5544",
        order_id: "ord_123",
        amount: 2500,
        currency: "HTG",
      },
    });

    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(rawBody)
      .digest("hex");

    const nowSec = Math.floor(Date.now() / 1000);

    // Valid signature within tolerance
    const isValid = await provider.verifyWebhookSignature(
      rawBody,
      validSignature,
      String(nowSec)
    );
    assert.strictEqual(isValid, true, "Valid signature and current timestamp must pass");

    // Invalid signature (tampered body)
    const tamperedBody = rawBody.replace("2500", "500");
    const isTamperedValid = await provider.verifyWebhookSignature(
      tamperedBody,
      validSignature,
      String(nowSec)
    );
    assert.strictEqual(isTamperedValid, false, "Tampered payload must be rejected");

    // Expired timestamp (10 minutes ago, exceeds 5-minute tolerance)
    const expiredTimestamp = String(nowSec - 600);
    const isExpiredValid = await provider.verifyWebhookSignature(
      rawBody,
      validSignature,
      expiredTimestamp
    );
    assert.strictEqual(isExpiredValid, false, "Timestamp older than 5 minutes must be rejected");

    // Future timestamp beyond tolerance (10 minutes in future)
    const futureTimestamp = String(nowSec + 600);
    const isFutureValid = await provider.verifyWebhookSignature(
      rawBody,
      validSignature,
      futureTimestamp
    );
    assert.strictEqual(isFutureValid, false, "Timestamp 10 min in the future must be rejected");

    console.log("   [PASS] HMAC SHA-256 signature and timestamp tolerance correctly verified.");
  }

  // 4. SQL Migration & Transactional RPC Validation
  console.log("\n4. Verifying transactional payment validation SQL migration...");
  {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20250119000000_transactional_payment_validation.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    assert.ok(sql.includes("validate_payment_transactional"), "RPC validate_payment_transactional defined");
    assert.ok(sql.includes("FOR UPDATE"), "Row locking FOR UPDATE must be used");
    assert.ok(sql.includes("AMOUNT_MISMATCH"), "Exact amount check must be present");
    assert.ok(sql.includes("DUPLICATE_TRANSACTION_ID"), "Duplicate transaction ID check must be present");
    assert.ok(sql.includes("idx_payments_provider_txn_validated_unique"), "Unique constraint for validated txn ID must be present");
    assert.ok(sql.includes("admin_audit_logs"), "Audit log entry must be written in the transaction");

    console.log("   [PASS] SQL transactional RPC migration conforms to all security rules.");
  }

  console.log("\nALL STEP S1-C PAYMENTS TESTS PASSED SUCCESSFULLY!\n");
}

runStepS1CTests().catch((err) => {
  console.error("Step S1-C test failure:", err);
  process.exit(1);
});
