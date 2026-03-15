'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Hash, Globe, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCommunity } from '@/lib/hooks/useCommunity';
import type { ChatRoom, ChatMessage } from '@/lib/types/community';

const QUICK_EMOJIS = ['👍', '🔥', '📈', '📉', '💎', '🚀'];

function timeStr(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LiveChat() {
  const {
    chatRooms,
    activeRoom,
    chatMessages,
    onlineUsers,
    typingUsers,
    fetchChatRooms,
    fetchGlobalRoom,
    setActiveRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    addReaction,
    sendTyping,
  } = useCommunity();

  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load rooms on mount
  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  // Auto-join global room if no active room
  useEffect(() => {
    if (!activeRoom && chatRooms.length === 0) {
      fetchGlobalRoom().then((room) => {
        setActiveRoom(room);
        joinRoom(room.id);
      });
    }
  }, [activeRoom, chatRooms, fetchGlobalRoom, setActiveRoom, joinRoom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSwitchRoom = useCallback(
    (room: ChatRoom) => {
      if (activeRoom) {
        leaveRoom(activeRoom.id);
      }
      setActiveRoom(room);
      joinRoom(room.id);
    },
    [activeRoom, leaveRoom, setActiveRoom, joinRoom],
  );

  const handleSend = () => {
    if (!message.trim() || !activeRoom) return;
    sendMessage(activeRoom.id, message.trim());
    setMessage('');
  };

  const handleTyping = () => {
    if (!activeRoom) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    sendTyping(activeRoom.id);
    typingTimeout.current = setTimeout(() => {}, 3000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 h-150">
      {/* Room List */}
      <Card className="overflow-y-auto">
        <CardHeader className="py-3 px-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Rooms
          </h3>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => handleSwitchRoom(room)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeRoom?.id === room.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                {room.type === 'GLOBAL' ? (
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{room.name}</span>
              </div>
            </button>
          ))}
          {chatRooms.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No rooms available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chat Panel */}
      <Card className="flex flex-col overflow-hidden">
        {/* Room Header */}
        <CardHeader className="py-3 px-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeRoom?.type === 'GLOBAL' ? (
                <Globe className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )}
              <span className="font-semibold text-sm">
                {activeRoom?.name || 'Select a room'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {onlineUsers.length} online
              </Badge>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence initial={false}>
            {chatMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onReaction={(emoji) => addReaction(msg.id, emoji)}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground italic"
            >
              {typingUsers.map((t) => t.displayName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                activeRoom
                  ? `Message #${activeRoom.name}`
                  : 'Select a room...'
              }
              disabled={!activeRoom}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || !activeRoom}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────── */
function MessageBubble({
  message,
  onReaction,
}: {
  message: ChatMessage;
  onReaction: (emoji: string) => void;
}) {
  const initials = (message.user.displayName || message.user.email || '??')
    .substring(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex gap-2.5"
    >
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {message.user.displayName || message.user.email}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {timeStr(message.createdAt)}
          </span>
        </div>
        <p className="text-sm mt-0.5 wrap-break-word">{message.content}</p>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-xs hover:bg-muted/80"
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}

        {/* Quick reaction bar (on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex gap-0.5">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReaction(emoji)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-xs"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
