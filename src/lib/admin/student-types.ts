export interface StudentCourseEnrollment {
  id?: string;
  courseId: string;
  slug: string;
  titleFr: string;
  titleHt: string;
  enrolledAt: string;
  note?: string | null;
  grantedBy?: string | null;
  progressPercent?: number;
  lastActivityAt?: string | null;
}

export interface StudentPayment {
  id: string;
  orderId: string;
  orderReference: string;
  courseTitle: string;
  amountHtg: number;
  provider: "moncash" | "natcash";
  status: "validated" | "awaiting_validation" | "failed" | "pending";
  createdAt: string;
}

export interface StudentItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "student" | "admin" | "instructor";
  locale: "fr" | "ht";
  createdAt: string;
  coursesCount: number;
  progressPercent?: number;
  lastActivityAt?: string | null;
  enrollments: StudentCourseEnrollment[];
  payments: StudentPayment[];
}

export interface AdminCourseOption {
  id: string;
  slug: string;
  titleFr: string;
  titleHt: string;
  priceHtg: number;
}
