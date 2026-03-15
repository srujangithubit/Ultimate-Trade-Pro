'use client';

import { useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { CommunityPost } from '@/lib/types/community';
import PostCard from './PostCard';

interface PostFeedProps {
  posts: CommunityPost[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function PostFeed({
  posts,
  loading,
  hasMore,
  onLoadMore,
}: PostFeedProps) {
  const observer = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            onLoadMore();
          }
        },
        { threshold: 0.1 },
      );
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, onLoadMore],
  );

  const safePosts = Array.isArray(posts) ? posts : [];

  if (!loading && safePosts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg mb-2">No posts yet</p>
        <p className="text-sm text-muted-foreground">
          Be the first to share a trade idea!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {safePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </AnimatePresence>

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && (
        <div ref={sentinelRef} className="h-4" />
      )}

      {!hasMore && safePosts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}
