'use client';

import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api/client';
import { useCommunityStore } from '@/lib/stores/communityStore';
import type {
  CommunityPost,
  PostComment,
  ChatMessage,
  ChatRoom,
  FeedQuery,
  CreatePostPayload,
  CreateCommentPayload,
  LeaderboardEntry,
  ReputationInfo,
} from '@/lib/types/community';
import { COMMUNITY_EVENTS } from '@/lib/types/community';

const API = '/api/community';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

/**
 * Helper: always grab the latest store actions via getState()
 * so callbacks never depend on the reactive `store` object.
 */
const getStore = () => useCommunityStore.getState();

export function useCommunity() {
  // Subscribe to state slices only (read-only, used in JSX)
  const posts = useCommunityStore((s) => s.posts);
  const feedLoading = useCommunityStore((s) => s.feedLoading);
  const feedPage = useCommunityStore((s) => s.feedPage);
  const hasMore = useCommunityStore((s) => s.hasMore);
  const sortBy = useCommunityStore((s) => s.sortBy);
  const filterSymbol = useCommunityStore((s) => s.filterSymbol);
  const filterDirection = useCommunityStore((s) => s.filterDirection);
  const activePost = useCommunityStore((s) => s.activePost);
  const activePostComments = useCommunityStore((s) => s.activePostComments);
  const commentsLoading = useCommunityStore((s) => s.commentsLoading);
  const chatRooms = useCommunityStore((s) => s.chatRooms);
  const activeRoom = useCommunityStore((s) => s.activeRoom);
  const chatMessages = useCommunityStore((s) => s.chatMessages);
  const onlineUsers = useCommunityStore((s) => s.onlineUsers);
  const typingUsers = useCommunityStore((s) => s.typingUsers);
  const leaderboard = useCommunityStore((s) => s.leaderboard);
  const isCreateModalOpen = useCommunityStore((s) => s.isCreateModalOpen);

  // Stable action references (these never change)
  const setSortBy = useCommunityStore((s) => s.setSortBy);
  const setFeedPage = useCommunityStore((s) => s.setFeedPage);
  const setActiveRoom = useCommunityStore((s) => s.setActiveRoom);
  const openCreateModal = useCommunityStore((s) => s.openCreateModal);
  const closeCreateModal = useCommunityStore((s) => s.closeCreateModal);
  const resetFeed = useCommunityStore((s) => s.resetFeed);

  const socketRef = useRef<Socket | null>(null);

  /* ─── Socket Setup ─────────────────────────────────────── */
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Clean up any lingering disconnected socket from Strict Mode re-mount
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current = null;
    }

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null;
    if (!token) return;

    const socket = io(`${WS_URL}/community`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect_error', (err) => {
      console.warn('[Community WS] Connection error:', err.message);
    });

    socket.on(COMMUNITY_EVENTS.NEW_MESSAGE, (msg: ChatMessage) => {
      getStore().addChatMessage(msg);
    });

    socket.on(
      COMMUNITY_EVENTS.ROOM_USERS,
      (data: { roomId: string; users: string[] }) => {
        getStore().setOnlineUsers(data.users);
      },
    );

    socket.on(
      COMMUNITY_EVENTS.USER_TYPING,
      (data: { userId: string; displayName: string }) => {
        getStore().addTypingUser(data);
        setTimeout(() => getStore().removeTypingUser(data.userId), 3000);
      },
    );

    socket.on(
      COMMUNITY_EVENTS.MESSAGE_REACTION,
      (data: { messageId: string; reactions: Record<string, string[]> }) => {
        getStore().updateMessageReactions(data.messageId, data.reactions);
      },
    );

    socket.on(
      COMMUNITY_EVENTS.NEW_POST,
      (post: CommunityPost) => {
        const s = getStore();
        s.setPosts([post, ...s.posts]);
      },
    );

    socketRef.current = socket;
    socket.connect();
  }, []);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socketRef.current = null;
    socket.removeAllListeners();

    if (socket.connected) {
      socket.disconnect();
    } else {
      // Socket is still connecting — wait for it to open, then close cleanly
      socket.once('connect', () => socket.disconnect());
      // If connection fails altogether, ensure cleanup
      socket.io.once('error', () => { try { socket.disconnect(); } catch { /* ignore */ } });
    }
  }, []);

  /* ─── Posts API ────────────────────────────────────────── */
  const fetchFeed = useCallback(
    async (query: FeedQuery = {}) => {
      getStore().setFeedLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.page) params.set('page', String(query.page));
        if (query.limit) params.set('limit', String(query.limit));
        if (query.sortBy) params.set('sortBy', query.sortBy);
        if (query.symbol) params.set('symbol', query.symbol);
        if (query.timeframe) params.set('timeframe', query.timeframe);
        if (query.direction) params.set('direction', query.direction);
        if (query.userId) params.set('userId', query.userId);

        const { data } = await api.get<CommunityPost[]>(
          `${API}/posts?${params.toString()}`,
        );
        const fetchedPosts = Array.isArray(data) ? data : [];

        if (query.page && query.page > 1) {
          getStore().appendPosts(fetchedPosts);
        } else {
          getStore().setPosts(fetchedPosts);
        }
        getStore().setHasMore(fetchedPosts.length >= (query.limit || 20));
      } finally {
        getStore().setFeedLoading(false);
      }
    },
    [],
  );

  const fetchTrending = useCallback(
    async (symbol?: string) => {
      const params = symbol ? `?symbol=${symbol}` : '';
      const { data } = await api.get<CommunityPost[]>(
        `${API}/posts/trending${params}`,
      );
      return Array.isArray(data) ? data : [];
    },
    [],
  );

  const fetchPostById = useCallback(
    async (postId: string) => {
      const { data } = await api.get<CommunityPost>(
        `${API}/posts/${postId}`,
      );
      getStore().setActivePost(data);
      return data;
    },
    [],
  );

  const createPost = useCallback(
    async (payload: CreatePostPayload) => {
      const formData = new FormData();
      formData.append('type', payload.type);
      formData.append('symbol', payload.symbol);
      formData.append('direction', payload.direction);
      formData.append('description', payload.description);
      if (payload.timeframe) formData.append('timeframe', payload.timeframe);
      if (payload.entry != null)
        formData.append('entry', String(payload.entry));
      if (payload.sl != null) formData.append('sl', String(payload.sl));
      if (payload.tp != null) formData.append('tp', String(payload.tp));
      if (payload.chartState)
        formData.append('chartState', payload.chartState);
      if (payload.image) formData.append('image', payload.image);

      const { data } = await api.post<CommunityPost>(`${API}/posts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const s = getStore();
      s.setPosts([data, ...s.posts]);
      return data;
    },
    [],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      await api.delete(`${API}/posts/${postId}`);
      getStore().removePost(postId);
    },
    [],
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const { data } = await api.post<CommunityPost>(
        `${API}/posts/${postId}/like`,
      );
      getStore().updatePost(postId, {
        likesCount: data.likesCount,
        isLiked: data.isLiked,
      });
      return data;
    },
    [],
  );

  const toggleSave = useCallback(
    async (postId: string) => {
      const { data } = await api.post<{ isSaved: boolean }>(
        `${API}/posts/${postId}/save`,
      );
      getStore().updatePost(postId, { isSaved: data.isSaved });
      return data;
    },
    [],
  );

  /* ─── Comments API ─────────────────────────────────────── */
  const fetchComments = useCallback(
    async (postId: string) => {
      getStore().setCommentsLoading(true);
      try {
        const { data } = await api.get<PostComment[]>(
          `${API}/posts/${postId}/comments`,
        );
        getStore().setActivePostComments(data);
        return data;
      } finally {
        getStore().setCommentsLoading(false);
      }
    },
    [],
  );

  const addComment = useCallback(
    async (payload: CreateCommentPayload) => {
      const { data } = await api.post<PostComment>(
        `${API}/posts/${payload.postId}/comments`,
        { text: payload.text },
      );
      getStore().addComment(data);
      return data;
    },
    [],
  );

  const replyToComment = useCallback(
    async (postId: string, parentId: string, text: string) => {
      const { data } = await api.post<PostComment>(
        `${API}/posts/${postId}/comments/reply/${parentId}`,
        { text },
      );
      getStore().addComment(data);
      return data;
    },
    [],
  );

  const toggleCommentLike = useCallback(async (postId: string, commentId: string) => {
    const { data } = await api.post<PostComment>(
      `${API}/posts/${postId}/comments/${commentId}/like`,
    );
    return data;
  }, []);

  const deleteComment = useCallback(async (postId: string, commentId: string) => {
    await api.delete(`${API}/posts/${postId}/comments/${commentId}`);
  }, []);

  /* ─── Chat API & Socket Actions ────────────────────────── */
  const fetchChatRooms = useCallback(async () => {
    const { data } = await api.get<ChatRoom[]>(`${API}/chat/rooms`);
    getStore().setChatRooms(data);
    return data;
  }, []);

  const fetchGlobalRoom = useCallback(async () => {
    const { data } = await api.get<ChatRoom>(`${API}/chat/rooms/global`);
    return data;
  }, []);

  const fetchSymbolRoom = useCallback(async (symbol: string) => {
    const { data } = await api.get<ChatRoom>(
      `${API}/chat/rooms/symbol/${symbol}`,
    );
    return data;
  }, []);

  const joinRoom = useCallback(
    (roomId: string) => {
      socketRef.current?.emit(COMMUNITY_EVENTS.JOIN_ROOM, { roomId });
    },
    [],
  );

  const leaveRoom = useCallback(
    (roomId: string) => {
      socketRef.current?.emit(COMMUNITY_EVENTS.LEAVE_ROOM, { roomId });
      getStore().setChatMessages([]);
    },
    [],
  );

  const sendMessage = useCallback(
    (roomId: string, content: string, fileUrl?: string) => {
      socketRef.current?.emit(COMMUNITY_EVENTS.SEND_MESSAGE, {
        roomId,
        content,
        fileUrl,
      });
    },
    [],
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      socketRef.current?.emit(COMMUNITY_EVENTS.ADD_REACTION, {
        messageId,
        emoji,
      });
    },
    [],
  );

  const sendTyping = useCallback(
    (roomId: string) => {
      socketRef.current?.emit(COMMUNITY_EVENTS.TYPING, { roomId });
    },
    [],
  );

  /* ─── Reputation API ───────────────────────────────────── */
  const fetchLeaderboard = useCallback(async () => {
    const { data } = await api.get<LeaderboardEntry[]>(
      `${API}/reputation/leaderboard`,
    );
    getStore().setLeaderboard(data);
    return data;
  }, []);

  const fetchUserReputation = useCallback(
    async (userId: string) => {
      const { data } = await api.get<ReputationInfo>(
        `${API}/reputation/${userId}`,
      );
      return data;
    },
    [],
  );

  /* ─── Listen for new messages from joined room ─────────── */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onHistory = (data: { roomId: string; messages: ChatMessage[] }) => {
      getStore().setChatMessages(data.messages);
    };
    socket.on('message_history', onHistory);
    return () => {
      socket.off('message_history', onHistory);
    };
  }, []);

  return {
    // State slices
    posts,
    feedLoading,
    feedPage,
    hasMore,
    sortBy,
    filterSymbol,
    filterDirection,
    activePost,
    activePostComments,
    commentsLoading,
    chatRooms,
    activeRoom,
    chatMessages,
    onlineUsers,
    typingUsers,
    leaderboard,
    isCreateModalOpen,

    // Stable store actions
    setSortBy,
    setFeedPage,
    setActiveRoom,
    openCreateModal,
    closeCreateModal,
    resetFeed,

    // Socket
    connectSocket,
    disconnectSocket,

    // Posts
    fetchFeed,
    fetchTrending,
    fetchPostById,
    createPost,
    deletePost,
    toggleLike,
    toggleSave,

    // Comments
    fetchComments,
    addComment,
    replyToComment,
    toggleCommentLike,
    deleteComment,

    // Chat
    fetchChatRooms,
    fetchGlobalRoom,
    fetchSymbolRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    addReaction,
    sendTyping,

    // Reputation
    fetchLeaderboard,
    fetchUserReputation,
  };
}
