'use client';

import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { CommunityPost } from '@/lib/types/community';
import { Direction, PostType } from '@/lib/types/community';
import { useAuth } from '@/lib/hooks/useAuth';

const DIRECTION_CONFIG = {
  [Direction.BULLISH]: {
    icon: TrendingUp,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: 'Bullish',
  },
  [Direction.BEARISH]: {
    icon: TrendingDown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: 'Bearish',
  },
  [Direction.NEUTRAL]: {
    icon: Minus,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    label: 'Neutral',
  },
};

const TYPE_LABELS: Record<PostType, string> = {
  [PostType.TRADE_IDEA]: 'Trade Idea',
  [PostType.ANALYSIS]: 'Analysis',
  [PostType.FORECAST]: 'Forecast',
  [PostType.JOURNAL]: 'Journal',
  [PostType.DISCUSSION]: 'Discussion',
};

interface PostDetailProps {
  post: CommunityPost;
  onLike: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function PostDetail({
  post,
  onLike,
  onSave,
  onDelete,
}: PostDetailProps) {
  const { user } = useAuth();
  const dir = DIRECTION_CONFIG[post.direction];
  const DirIcon = dir.icon;
  const initials = (post.user.displayName || post.user.email || '??')
    .substring(0, 2)
    .toUpperCase();

  const rrRatio =
    post.entry && post.sl && post.tp
      ? Math.abs(post.tp - post.entry) / Math.abs(post.entry - post.sl)
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <span className="font-semibold">
                {post.user.displayName || post.user.email}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[post.type]}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${dir.color} ${dir.bg} border-0`}
                >
                  <DirIcon className="h-3 w-3 mr-1" />
                  {dir.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {user?.id === post.userId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Symbol & Levels */}
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{post.symbol}</span>
          {post.timeframe && (
            <Badge variant="secondary">{post.timeframe}</Badge>
          )}
        </div>

        {(post.entry || post.sl || post.tp) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {post.entry != null && (
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Entry</p>
                <p className="font-mono font-semibold">{post.entry}</p>
              </div>
            )}
            {post.sl != null && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
                <p className="text-xs text-red-500">Stop Loss</p>
                <p className="font-mono font-semibold text-red-500">
                  {post.sl}
                </p>
              </div>
            )}
            {post.tp != null && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-center">
                <p className="text-xs text-green-500">Take Profit</p>
                <p className="font-mono font-semibold text-green-500">
                  {post.tp}
                </p>
              </div>
            )}
            {rrRatio != null && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-center">
                <p className="text-xs text-blue-500">R:R Ratio</p>
                <p className="font-mono font-semibold text-blue-500">
                  1:{rrRatio.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {post.description}
        </p>

        {/* Chart image */}
        {post.imageUrl && (
          <div className="rounded-lg overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt={`${post.symbol} chart`}
              className="w-full object-contain max-h-125"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-border">
        <div className="flex items-center gap-2 w-full pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            className={`gap-1.5 ${post.isLiked ? 'text-red-500' : ''}`}
          >
            <Heart
              className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`}
            />
            {post.likesCount}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {post.commentsCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className={`gap-1.5 ${post.isSaved ? 'text-yellow-500' : ''}`}
          >
            <Bookmark
              className={`h-4 w-4 ${post.isSaved ? 'fill-current' : ''}`}
            />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 ml-auto">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
