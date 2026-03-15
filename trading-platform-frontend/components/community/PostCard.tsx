'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { CommunityPost } from '@/lib/types/community';
import { Direction, PostType } from '@/lib/types/community';
import { useCommunity } from '@/lib/hooks/useCommunity';
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

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface PostCardProps {
  post: CommunityPost;
}

export default function PostCard({ post }: PostCardProps) {
  const { toggleLike, toggleSave, deletePost } = useCommunity();
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [likesCount, setLikesCount] = useState(post.likesCount);

  const dir = DIRECTION_CONFIG[post.direction];
  const DirIcon = dir.icon;

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked(!liked);
    setLikesCount((c) => (liked ? c - 1 : c + 1));
    try {
      await toggleLike(post.id);
    } catch {
      setLiked(liked);
      setLikesCount(post.likesCount);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved(!saved);
    try {
      await toggleSave(post.id);
    } catch {
      setSaved(saved);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deletePost(post.id);
  };

  const initials = (post.user.displayName || post.user.email || '??')
    .substring(0, 2)
    .toUpperCase();

  const rrRatio =
    post.entry && post.sl && post.tp
      ? Math.abs(post.tp - post.entry) / Math.abs(post.entry - post.sl)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/community/${post.id}`}>
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {post.user.displayName || post.user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {timeAgo(post.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {TYPE_LABELS[post.type]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${dir.color} ${dir.bg} border-0`}
                    >
                      <DirIcon className="h-3 w-3 mr-0.5" />
                      {dir.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {user?.id === post.userId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pb-3">
            {/* Symbol & Trade Info */}
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{post.symbol}</span>
              {post.timeframe && (
                <Badge variant="secondary" className="text-xs">
                  {post.timeframe}
                </Badge>
              )}
            </div>

            {/* Trade levels */}
            {(post.entry || post.sl || post.tp) && (
              <div className="flex gap-4 text-xs">
                {post.entry != null && (
                  <span>
                    Entry:{' '}
                    <span className="font-mono font-medium">{post.entry}</span>
                  </span>
                )}
                {post.sl != null && (
                  <span className="text-red-500">
                    SL:{' '}
                    <span className="font-mono font-medium">{post.sl}</span>
                  </span>
                )}
                {post.tp != null && (
                  <span className="text-green-500">
                    TP:{' '}
                    <span className="font-mono font-medium">{post.tp}</span>
                  </span>
                )}
                {rrRatio != null && (
                  <span className="text-blue-500">
                    R:R{' '}
                    <span className="font-mono font-medium">
                      1:{rrRatio.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
              {post.description}
            </p>

            {/* Chart snapshot image */}
            {post.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl}
                  alt={`${post.symbol} chart`}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-0 border-t border-border">
            <div className="flex items-center gap-1 w-full pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`gap-1.5 ${liked ? 'text-red-500' : ''}`}
              >
                <Heart
                  className={`h-4 w-4 ${liked ? 'fill-current' : ''}`}
                />
                <span className="text-xs">{likesCount}</span>
              </Button>

              <Button variant="ghost" size="sm" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">{post.commentsCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                className={`gap-1.5 ${saved ? 'text-yellow-500' : ''}`}
              >
                <Bookmark
                  className={`h-4 w-4 ${saved ? 'fill-current' : ''}`}
                />
              </Button>

              <Button variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
