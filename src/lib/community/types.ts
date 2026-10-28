export type UserRole = "student" | "instructor" | "admin";

export interface CommunityReactionSummary {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface CommunityReplyPreview {
  id: string;
  authorName: string;
  body: string;
}

export interface CommunityMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatarUrl?: string | null;
  body: string;
  attachmentUrl?: string | null;
  replyToId?: string | null;
  replyPreview?: CommunityReplyPreview | null;
  pinned: boolean;
  pinnedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  reactions: CommunityReactionSummary[];
  isOptimistic?: boolean;
  failedToSend?: boolean;
}

export interface CommunityMember {
  id: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export interface CommunityGroupInfo {
  id: string;
  name: string;
  description: string;
  totalMembersCount: number;
  onlineCount: number;
  lastMessageSnippet: string;
  lastMessageTime: string;
  unreadCount: number;
  pinnedMessage?: CommunityMessage | null;
}
