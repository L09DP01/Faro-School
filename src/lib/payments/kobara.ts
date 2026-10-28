import type {
  PaymentProvider,
  OrderDetails,
  PaymentCreationResult,
  PaymentStatus,
  PaymentMethod,
} from "./types";

export class KobaraProvider implements PaymentProvider {
  private apiUrl: string;
  private secretKey: string | undefined;
  private webhookSecret: string | undefined;
  public readonly isMock: boolean;

  constructor() {
    this.apiUrl = process.env.KOBARA_API_URL || "https://api.kobara.app";
    this.secretKey = process.env.KOBARA_SECRET_KEY;
    this.webhookSecret = process.env.KOBARA_WEBHOOK_SECRET;

    // Automatic MOCK mode if no secret key is provided
    this.isMock = !this.secretKey || this.secretKey.startsWith("mock_");
  }

  async createPayment(
    order: OrderDetails,
    method: PaymentMethod = "moncash"
  ): Promise<PaymentCreationResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (this.isMock) {
      // Simulation mode for local development
      const mockPaymentId = `kbr_mock_${Date.now()}`;
      const redirectUrl = `${appUrl}/api/payments/kobara/mock-gate?paymentId=${mockPaymentId}&orderId=${encodeURIComponent(
        order.orderId
      )}&reference=${encodeURIComponent(
        order.reference
      )}&amount=${order.amountHtg}&method=${method}&course=${encodeURIComponent(
        order.courseTitle
      )}`;

      return {
        redirectUrl,
        reference: order.reference,
        kobaraPaymentId: mockPaymentId,
        status: "pending",
      };
    }

    // Live Kobara API request
    const response = await fetch(`${this.apiUrl}/v1/payments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
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
        )}&reference=${encodeURIComponent(order.reference)}&status=success`,
        cancel_url: `${appUrl}/api/payments/kobara/return?orderId=${encodeURIComponent(
          order.orderId
        )}&reference=${encodeURIComponent(order.reference)}&status=cancelled`,
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kobara API error (${response.status}): ${errorText}`);
    }

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
        `Kobara did not return a valid checkout URL: ${JSON.stringify(json)}`
      );
    }

    const kobaraId = json.data?.id || json.id;

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

      const paymentStatus = (json.data?.status || json.status || "").toLowerCase();

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

  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean> {
    if (!this.webhookSecret || this.isMock) {
      return true;
    }

    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.webhookSecret);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payload)
      );

      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const expectedSignature = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return expectedSignature === signature;
    } catch {
      return false;
    }
  }
}
