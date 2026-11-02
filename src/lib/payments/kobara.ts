import { isDemoMode } from "@/lib/config";
import type {
  PaymentProvider,
  OrderDetails,
  PaymentCreationResult,
  PaymentStatus,
  PaymentMethod,
} from "./types";

async function computeHmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export class KobaraProvider implements PaymentProvider {
  private apiUrl: string;
  private secretKey: string | undefined;
  private webhookSecret: string | undefined;
  public readonly isMock: boolean;

  constructor() {
    this.apiUrl =
      process.env.KOBARA_BASE_URL ||
      process.env.KOBARA_API_URL ||
      "https://api.kobara.app";
    this.secretKey =
      process.env.KOBARA_API_KEY || process.env.KOBARA_SECRET_KEY;
    this.webhookSecret = process.env.KOBARA_WEBHOOK_SECRET;

    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "production";
    const mode = process.env.KOBARA_MODE;

    if (isProd) {
      if (mode !== "live") {
        throw new Error(
          "SECURITY HALT: KOBARA_MODE must be 'live' in production. Payment processing refused."
        );
      }
      if (!this.secretKey || this.secretKey.startsWith("mock_")) {
        throw new Error(
          "SECURITY HALT: KOBARA_API_KEY (or KOBARA_SECRET_KEY) is missing or invalid in production."
        );
      }
      if (!this.webhookSecret) {
        throw new Error(
          "SECURITY HALT: KOBARA_WEBHOOK_SECRET is missing in production."
        );
      }
    }

    // Simulation is ONLY allowed when isDemoMode() is true (APP_MODE=demo and not production)
    this.isMock = Boolean(
      isDemoMode() && (!this.secretKey || this.secretKey.startsWith("mock_"))
    );
  }

  async createPayment(
    order: OrderDetails,
    method: PaymentMethod = "moncash"
  ): Promise<PaymentCreationResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "production";

    if (isProd && this.isMock) {
      throw new Error("SECURITY VIOLATION: Payment simulation is forbidden in production.");
    }

    if (!this.secretKey) {
      throw new Error(
        "KOBARA_API_KEY / KOBARA_SECRET_KEY is missing. Payment creation refused."
      );
    }

    // Live Kobara API request
    const response = await fetch(`${this.apiUrl}/v1/payments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
        "Idempotency-Key": `${order.orderId}:${method}:${order.amountHtg}`,
      },
      body: JSON.stringify({
        amount: order.amountHtg,
        currency: "HTG",
        provider: method, // 'moncash' | 'natcash' | 'kobara'
        description: `Inscription - ${order.courseTitle}`,
        order_id: order.reference,
        customer: {
          name: order.customerName || "Étudiant Faro",
          email: order.customerEmail,
          phone: order.payerPhone,
        },
        success_url: `${appUrl}/api/payments/kobara/return?orderId=${encodeURIComponent(
          order.orderId
        )}&locale=${order.metadata?.locale === "ht" ? "ht" : "fr"}&reference=${encodeURIComponent(order.reference)}`,
        cancel_url: `${appUrl}/api/payments/kobara/return?orderId=${encodeURIComponent(
          order.orderId
        )}&locale=${order.metadata?.locale === "ht" ? "ht" : "fr"}&reference=${encodeURIComponent(order.reference)}`,
        metadata: {
          order_id: order.orderId,
          course_id: order.courseId,
          user_id: order.userId,
          reference: order.reference,
          selected_provider: method,
          ...order.metadata,
        },
      }),
    });

    if (!response.ok) throw new Error("payment_gateway_unavailable");

    const json = (await response.json()) as {
      status?: string;
      data?: {
        id: string;
        checkout_url?: string;
        payment_url?: string;
        url?: string;
        status?: string;
      };
      checkout_url?: string;
      id?: string;
    };

    const checkoutUrl =
      json.data?.checkout_url ||
      json.data?.payment_url ||
      json.data?.url ||
      json.checkout_url;

    if (!checkoutUrl) {
      throw new Error(
        "payment_checkout_unavailable"
      );
    }

    const target=new URL(checkoutUrl);
    if(target.protocol!=="https:"||target.username||target.password)throw Error("payment_checkout_invalid");
    const kobaraId = json.data?.id || json.id;
    if(!kobaraId)throw Error("payment_id_missing");

    return {
      redirectUrl: checkoutUrl,
      reference: order.reference,
      kobaraPaymentId: kobaraId,
      status: "pending",
    };
  }

  async verifyPayment(paymentIdOrRef: string): Promise<PaymentStatus> {
    if (this.isMock) {
      if (
        paymentIdOrRef.includes("fail") ||
        paymentIdOrRef.includes("mock_fail") ||
        paymentIdOrRef.includes("error")
      ) {
        return "failed";
      }
      return "validated";
    }

    if (!this.secretKey) {
      throw new Error(
        "KOBARA_SECRET_KEY is missing. Payment verification refused."
      );
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/v1/payments/${encodeURIComponent(paymentIdOrRef)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      if (!response.ok) {
        return "failed";
      }

      const json = (await response.json()) as {
        status?: string;
        data?: {
          status?: string;
        };
      };

      const paymentStatus = (
        json.data?.status ||
        json.status ||
        ""
      ).toLowerCase();

      if (
        paymentStatus === "succeeded" ||
        paymentStatus === "validated" ||
        paymentStatus === "paid" ||
        paymentStatus === "success"
      ) {
        return "validated";
      }

      if (paymentStatus === "pending") {
        return "pending";
      }

      return "failed";
    } catch {
      return "failed";
    }
  }

  /**
   * Verifies the webhook signature using crypto.timingSafeEqual on the raw body.
   * Never parses JSON prior to verification.
   * Rejects requests if timestamp exceeds 5 minutes (300 seconds) tolerance.
   */
  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    timestampHeader?: string | null
  ): Promise<boolean> {
    if (!this.webhookSecret) {
      if (this.isMock) {
        return true;
      }
      throw new Error(
        "KOBARA_WEBHOOK_SECRET is missing. Webhook verification refused."
      );
    }

    if (!signature || signature.trim() === "") {
      return false;
    }

    // Official Kobara contract: t=<seconds>,v1=HMAC(secret, t + "." + rawBody).
    const match=/^t=(\d+),v1=([a-f0-9]{64})$/i.exec(signature.trim());
    if(!match)return false;
    const timestamp=Number(match[1]);
    if(!Number.isSafeInteger(timestamp)||Math.abs(Math.floor(Date.now()/1000)-timestamp)>300)return false;
    if(timestampHeader&&timestampHeader!==match[1])return false;
    const expected=await computeHmacSha256(this.webhookSecret,match[1]+"."+rawBody);
    return constantTimeEqual(match[2].toLowerCase(),expected);
  }
}
