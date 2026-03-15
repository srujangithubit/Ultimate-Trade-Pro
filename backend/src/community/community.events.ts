/**
 * Shared event name constants for community Socket.IO communication.
 * Used on both the gateway (server) and client side.
 */
export const COMMUNITY_EVENTS = {
  NEW_POST: 'community:new_post',
  NEW_COMMENT: 'community:new_comment',
  POST_LIKED: 'community:post_liked',
  NEW_MESSAGE: 'community:new_message',
  USER_TYPING: 'community:user_typing',
  ROOM_USERS: 'community:room_users',
  MESSAGE_REACTION: 'community:message_reaction',
  JOIN_ROOM: 'community:join_room',
  LEAVE_ROOM: 'community:leave_room',
  SEND_MESSAGE: 'community:send_message',
  ADD_REACTION: 'community:add_reaction',
  TYPING: 'community:typing',
  USER_ONLINE: 'community:user_online',
  USER_OFFLINE: 'community:user_offline',
} as const;

export type CommunityEventName =
  (typeof COMMUNITY_EVENTS)[keyof typeof COMMUNITY_EVENTS];
