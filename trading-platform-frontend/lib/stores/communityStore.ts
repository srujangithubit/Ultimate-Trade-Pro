import { create } from 'zustand';
import type {
  CommunityPost,
  PostComment,
  ChatRoom,
  ChatMessage,
  SortBy,
  Direction,
  LeaderboardEntry,
} from '../types/community';

/* ─── State Shape ───────────────────────────────────────── */
interface CommunityState {
  // Feed
  posts: CommunityPost[];
  feedLoading: boolean;
  feedPage: number;
  hasMore: boolean;
  sortBy: SortBy | null;
  filterSymbol: string | null;
  filterDirection: Direction | null;

  // Active post
  activePost: CommunityPost | null;
  activePostComments: PostComment[];
  commentsLoading: boolean;

  // Chat
  chatRooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  chatMessages: ChatMessage[];
  onlineUsers: string[];
  typingUsers: { userId: string; displayName: string }[];

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Create post modal
  isCreateModalOpen: boolean;

  // Actions: Feed
  setPosts: (posts: CommunityPost[]) => void;
  appendPosts: (posts: CommunityPost[]) => void;
  setFeedLoading: (v: boolean) => void;
  setFeedPage: (page: number) => void;
  setHasMore: (v: boolean) => void;
  setSortBy: (s: SortBy | null) => void;
  setFilterSymbol: (s: string | null) => void;
  setFilterDirection: (d: Direction | null) => void;

  // Actions: Post
  setActivePost: (p: CommunityPost | null) => void;
  updatePost: (id: string, partial: Partial<CommunityPost>) => void;
  removePost: (id: string) => void;

  // Actions: Comments
  setActivePostComments: (c: PostComment[]) => void;
  addComment: (c: PostComment) => void;
  setCommentsLoading: (v: boolean) => void;

  // Actions: Chat
  setChatRooms: (rooms: ChatRoom[]) => void;
  setActiveRoom: (room: ChatRoom | null) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setOnlineUsers: (users: string[]) => void;
  addTypingUser: (u: { userId: string; displayName: string }) => void;
  removeTypingUser: (userId: string) => void;
  updateMessageReactions: (
    messageId: string,
    reactions: Record<string, string[]>,
  ) => void;

  // Actions: Leaderboard
  setLeaderboard: (entries: LeaderboardEntry[]) => void;

  // Actions: Modal
  openCreateModal: () => void;
  closeCreateModal: () => void;

  // Reset
  resetFeed: () => void;
}

/* ─── Store ─────────────────────────────────────────────── */
export const useCommunityStore = create<CommunityState>((set) => ({
  // Initial state
  posts: [],
  feedLoading: false,
  feedPage: 1,
  hasMore: true,
  sortBy: null,
  filterSymbol: null,
  filterDirection: null,

  activePost: null,
  activePostComments: [],
  commentsLoading: false,

  chatRooms: [],
  activeRoom: null,
  chatMessages: [],
  onlineUsers: [],
  typingUsers: [],

  leaderboard: [],

  isCreateModalOpen: false,

  // ── Feed Actions ──
  setPosts: (posts) => set({ posts }),
  appendPosts: (posts) =>
    set((s) => ({ posts: [...s.posts, ...posts] })),
  setFeedLoading: (feedLoading) => set({ feedLoading }),
  setFeedPage: (feedPage) => set({ feedPage }),
  setHasMore: (hasMore) => set({ hasMore }),
  setSortBy: (sortBy) => set({ sortBy }),
  setFilterSymbol: (filterSymbol) => set({ filterSymbol }),
  setFilterDirection: (filterDirection) => set({ filterDirection }),

  // ── Post Actions ──
  setActivePost: (activePost) => set({ activePost }),
  updatePost: (id, partial) =>
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === id ? { ...p, ...partial } : p,
      ),
      activePost:
        s.activePost?.id === id
          ? { ...s.activePost, ...partial }
          : s.activePost,
    })),
  removePost: (id) =>
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== id),
      activePost: s.activePost?.id === id ? null : s.activePost,
    })),

  // ── Comments Actions ──
  setActivePostComments: (activePostComments) =>
    set({ activePostComments }),
  addComment: (c) =>
    set((s) => ({
      activePostComments: [...s.activePostComments, c],
    })),
  setCommentsLoading: (commentsLoading) => set({ commentsLoading }),

  // ── Chat Actions ──
  setChatRooms: (chatRooms) => set({ chatRooms }),
  setActiveRoom: (activeRoom) => set({ activeRoom }),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
    })),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  addTypingUser: (u) =>
    set((s) => {
      if (s.typingUsers.find((t) => t.userId === u.userId)) return s;
      return { typingUsers: [...s.typingUsers, u] };
    }),
  removeTypingUser: (userId) =>
    set((s) => ({
      typingUsers: s.typingUsers.filter((t) => t.userId !== userId),
    })),
  updateMessageReactions: (messageId, reactions) =>
    set((s) => ({
      chatMessages: s.chatMessages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m,
      ),
    })),

  // ── Leaderboard ──
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  // ── Modal ──
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  // ── Reset ──
  resetFeed: () =>
    set({
      posts: [],
      feedPage: 1,
      hasMore: true,
      feedLoading: false,
      sortBy: null,
      filterSymbol: null,
      filterDirection: null,
    }),
}));
