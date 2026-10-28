export type PaymentMethod = "moncash" | "natcash" | "kobara";

export type PaymentStatus =
  | "pending"
  | "awaiting_validation"
  | "validated"
  | "failed";

export interface OrderDetails {
  orderId: string;
  reference: string;
  amountHtg: number;
  courseId: string;
  courseTitle: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  payerPhone?: string;
  metadata?: Record<string, any>;
}

export interface PaymentCreationResult {
  redirectUrl: string;
  reference: string;
  kobaraPaymentId?: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createPayment(
    order: OrderDetails,
    method: PaymentMethod
  ): Promise<PaymentCreationResult>;
  verifyPayment(referenceOrPaymentId: string): Promise<PaymentStatus>;
  verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;
}
