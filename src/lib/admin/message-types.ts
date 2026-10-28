export interface ContactMessageItem {
  id: string;
  name: string;
  contact: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export type MessageFilterStatus = "all" | "unread" | "read";
