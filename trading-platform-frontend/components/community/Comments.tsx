'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Reply, Trash2, Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PostComment } from '@/lib/types/community';
import { useAuth } from '@/lib/hooks/useAuth';

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

interface CommentsProps {
  comments: PostComment[];
  loading: boolean;
  postId: string;
  onAddComment: (text: string) => Promise<unknown>;
  onReply: (parentId: string, text: string) => Promise<unknown>;
  onLike: (commentId: string) => Promise<unknown>;
  onDelete: (commentId: string) => Promise<unknown>;
}

function CommentItem({
  comment,
  depth,
  onReply,
  onLike,
  onDelete,
}: {
  comment: PostComment;
  depth: number;
  onReply: (parentId: string, text: string) => Promise<unknown>;
  onLike: (commentId: string) => Promise<unknown>;
  onDelete: (commentId: string) => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initials = (comment.user.displayName || comment.user.email || '??')
    .substring(0, 2)
    .toUpperCase();

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText('');
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={depth > 0 ? 'ml-8 border-l-2 border-border pl-4' : ''}
    >
      <div className="flex gap-3 py-3">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {comment.user.displayName || comment.user.email}
            </span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap">
            {comment.isDeleted ? (
              <span className="italic text-muted-foreground">
                [deleted]
              </span>
            ) : (
              comment.text
            )}
          </p>

          {!comment.isDeleted && (
            <div className="flex items-center gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike(comment.id)}
                className={`h-7 px-2 gap-1 text-xs ${
                  comment.isLiked ? 'text-red-500' : ''
                }`}
              >
                <Heart
                  className={`h-3 w-3 ${
                    comment.isLiked ? 'fill-current' : ''
                  }`}
                />
                {comment.likesCount > 0 && comment.likesCount}
              </Button>

              {depth < 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyOpen(!replyOpen)}
                  className="h-7 px-2 gap-1 text-xs"
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>
              )}

              {user?.id === comment.userId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(comment.id)}
                  className="h-7 px-2 gap-1 text-xs text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Reply input */}
          <AnimatePresence>
            {replyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex gap-2"
              >
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-15 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleReply();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyText.trim() || submitting}
                  className="self-end"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  onReply={onReply}
                  onLike={onLike}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Comments({
  comments,
  loading,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postId,
  onAddComment,
  onReply,
  onLike,
  onDelete,
}: CommentsProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(text.trim());
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-lg font-semibold">
          Comments ({comments.length})
        </h3>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Comment input */}
        <div className="flex gap-3 pb-4 border-b border-border">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-20 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="self-end"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Comments list */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No comments yet. Be the first!
          </p>
        )}

        <AnimatePresence>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={onReply}
              onLike={onLike}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
