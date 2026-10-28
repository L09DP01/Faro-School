export type ConversationStatus =
  | "open"
  | "ai_handling"
  | "waiting_staff"
  | "staff_replied"
  | "closed";

export type SenderType = "student" | "staff" | "ai" | "system";

export interface PrivateMessage {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId?: string | null;
  senderName?: string;
  senderRole?: "student" | "instructor" | "admin";
  senderAvatarUrl?: string | null;
  body: string;
  meta?: {
    model?: string;
    confidence?: number;
    inputTokens?: number;
    outputTokens?: number;
    escalateReason?: string;
    [key: string]: any;
  };
  createdAt: string;
  readAt?: string | null;
  isOptimistic?: boolean;
}

export interface Conversation {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl?: string | null;
  staffId: string;
  staffName: string;
  staffRole: "instructor" | "admin";
  staffAvatarUrl?: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
  subject: string;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
  unreadCount?: number;
  lastMessagePreview?: string;
  isStaffOnline?: boolean;
}

export interface EscalationRecord {
  id: string;
  conversationId: string;
  triggerMessageId?: string | null;
  reason: string;
  emailStatus: "pending" | "sent" | "failed";
  deadlineAt: string;
  resolvedAt?: string | null;
  followupSentAt?: string | null;
  createdAt: string;
}

export interface AiKnowledgeFaq {
  id: string;
  question: string;
  answer: string;
}

export interface InstructorAiSettings {
  enabled: boolean;
  name: string;
  tone: "friendly" | "professional" | "concise" | string;
  languages: ("fr" | "ht")[];
  greeting?: string;
  customInstructions?: string; // max 4,000 chars
  knowledgeBase: {
    faq: AiKnowledgeFaq[];
    snippets: string[];
  };
  alwaysEscalate: string[];
  confidenceThreshold: number; // 0.50 to 0.95
  availabilityHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  escalationEmail?: string;
}

export interface InstructorAiVersion {
  id: string;
  instructorId: string;
  versionNumber: number;
  settings: InstructorAiSettings;
  createdAt: string;
}

export interface EnrolledCourseOption {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  payload: {
    conversationId?: string;
    messageSnippet?: string;
    senderName?: string;
    courseTitle?: string;
    [key: string]: any;
  };
  readAt?: string | null;
  createdAt: string;
}
