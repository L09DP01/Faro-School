export type PaymentStatusFilter = "all" | "awaiting_validation" | "validated" | "failed";

export interface AdminPaymentItem {
  id: string;
  orderId: string;
  orderReference: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  courseId: string;
  courseTitleFr: string;
  courseTitleHt: string;
  provider: "moncash" | "natcash" | "kobara";
  providerTxnId: string;
  payerPhone: string;
  amountHtg: number;
  status: "pending" | "awaiting_validation" | "validated" | "failed";
  validatedAt: string | null;
  validatedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminPaymentsKPIs {
  totalValidated: number;
  awaitingCount: number;
  moncashTotal: number;
  natcashTotal: number;
}
