/* ───────────────────── Community Types ───────────────────── */

// ─── Enums ──────────────────────────────────────────────────
export enum PostType {
  TRADE_IDEA = 'TRADE_IDEA',
  ANALYSIS = 'ANALYSIS',
  FORECAST = 'FORECAST',
  JOURNAL = 'JOURNAL',
  DISCUSSION = 'DISCUSSION',
}

export enum Direction {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export enum RoomType {
  GLOBAL = 'GLOBAL',
  SYMBOL = 'SYMBOL',
  PRIVATE = 'PRIVATE',
}

export enum SortBy {
  LATEST = 'LATEST',
  MOST_LIKED = 'MOST_LIKED',
  MOST_COMMENTED = 'MOST_COMMENTED',
  TRENDING = 'TRENDING',
}

// ─── Core Models ────────────────────────────────────────────
export interface CommunityUser {
  id: string;
  displayName: string | null;
  email: string;
  reputationScore: number;
}

export interface ChartSnapshot {
  id: string;
  postId: string;
  timeframe: string;
  symbol: string;
  indicators: Record<string, unknown> | null;
  drawings: Record<string, unknown> | null;
  visibleRangeFrom: number | null;
  visibleRangeTo: number | null;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  type: PostType;
  symbol: string;
  timeframe: string | null;
  direction: Direction;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  description: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  trendingScore: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  user: CommunityUser;
  chartSnapshot: ChartSnapshot | null;
  isLiked?: boolean;
  isSaved?: boolean;
  _count?: { comments: number };
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  text: string;
  likesCount: number;
  isDeleted: boolean;
  createdAt: string;
  user: CommunityUser;
  isLiked?: boolean;
  replies?: PostComment[];
}

export interface ChatRoom {
  id: string;
  name: string;
  type: RoomType;
  symbol: string | null;
  createdAt: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  fileUrl: string | null;
  reactions: Record<string, string[]>;
  isDeleted: boolean;
  createdAt: string;
  user: CommunityUser;
}

export interface ReputationInfo {
  user: CommunityUser;
  level: string;
  badge: string;
  nextLevel: string;
  pointsToNext: number;
  events: ReputationEvent[];
}

export interface ReputationEvent {
  id: string;
  userId: string;
  action: string;
  points: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  email: string;
  reputationScore: number;
  level: { label: string; color: string; badge: string };
}

// ─── Feed / Query ───────────────────────────────────────────
export interface FeedQuery {
  page?: number;
  limit?: number;
  sortBy?: SortBy;
  symbol?: string;
  timeframe?: string;
  direction?: Direction;
  userId?: string;
}

export interface CreatePostPayload {
  type: PostType;
  symbol: string;
  timeframe?: string;
  direction: Direction;
  entry?: number;
  sl?: number;
  tp?: number;
  description: string;
  chartState?: string; // JSON stringified
  image?: File;
}

export interface CreateCommentPayload {
  postId: string;
  text: string;
}

// ─── Chat Events ────────────────────────────────────────────
export const COMMUNITY_EVENTS = {
  NEW_POST: 'new_post',
  NEW_COMMENT: 'new_comment',
  POST_LIKED: 'post_liked',
  NEW_MESSAGE: 'new_message',
  USER_TYPING: 'user_typing',
  ROOM_USERS: 'room_users',
  MESSAGE_REACTION: 'message_reaction',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  ADD_REACTION: 'add_reaction',
  TYPING: 'typing',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
} as const;
