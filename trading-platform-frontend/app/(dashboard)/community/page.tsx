'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TrendingUp, Clock, Heart, MessageCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommunity } from '@/lib/hooks/useCommunity';
import { SortBy } from '@/lib/types/community';
import { fadeInUp, staggerContainer } from '@/lib/utils/motion';
import LeftSidebar from '@/components/community/LeftSidebar';
import RightSidebar from '@/components/community/RightSidebar';
import PostFeed from '@/components/community/PostFeed';
import CreatePostModal from '@/components/community/CreatePostModal';
import LiveChat from '@/components/community/LiveChat';

type TabValue = 'feed' | 'trending' | 'chat' | 'leaderboard';

export default function CommunityPage() {
  const {
    posts,
    feedLoading,
    feedPage,
    hasMore,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    fetchFeed,
    fetchTrending,
    fetchLeaderboard,
    connectSocket,
    disconnectSocket,
    setSortBy,
    setFeedPage,
    resetFeed,
    leaderboard,
  } = useCommunity();

  const [activeTab, setActiveTab] = useState<TabValue>('feed');
  const [trendingPosts, setTrendingPosts] = useState<typeof posts>([]);

  // Connect socket on mount — deferred to survive React Strict Mode
  // double-invoke (setup → cleanup → setup). Without the timeout, the
  // first cleanup would call disconnect() while the WebSocket transport
  // is still CONNECTING, triggering the browser warning.
  useEffect(() => {
    const timer = setTimeout(() => connectSocket(), 0);
    return () => {
      clearTimeout(timer);
      disconnectSocket();
    };
  }, [connectSocket, disconnectSocket]);

  // Initial feed load
  useEffect(() => {
    fetchFeed({ page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSortChange = (sort: string) => {
    const sortMap: Record<string, SortBy> = {
      latest: SortBy.LATEST,
      liked: SortBy.MOST_LIKED,
      commented: SortBy.MOST_COMMENTED,
      trending: SortBy.TRENDING,
    };
    const s = sortMap[sort] || SortBy.LATEST;
    setSortBy(s);
    resetFeed();
    fetchFeed({ page: 1, limit: 20, sortBy: s });
  };

  const loadMore = () => {
    const next = feedPage + 1;
    setFeedPage(next);
    fetchFeed({ page: next, limit: 20 });
  };

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab as TabValue);
    if (tab === 'trending') {
      const data = await fetchTrending();
      setTrendingPosts(data);
    }
    if (tab === 'leaderboard') {
      await fetchLeaderboard();
    }
  };

  return (
    <div className="flex h-full gap-0">
      {/* Left Sidebar */}
      <div className="hidden lg:block w-64 shrink-0 border-r border-border">
        <LeftSidebar onFilterChange={(symbol) => {
          resetFeed();
          fetchFeed({ page: 1, limit: 20, symbol: symbol || undefined });
        }} />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <motion.div
          className="max-w-3xl mx-auto px-4 py-6 space-y-6"
          {...staggerContainer}
        >
          {/* Header */}
          <motion.div
            className="flex items-center justify-between"
            {...fadeInUp}
          >
            <div>
              <h1 className="text-2xl font-bold">Community</h1>
              <p className="text-sm text-muted-foreground">
                Share ideas, discuss strategies, and connect with traders
              </p>
            </div>
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="feed" className="gap-1.5">
                <Clock className="h-4 w-4" />
                Feed
              </TabsTrigger>
              <TabsTrigger value="trending" className="gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                Live Chat
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-1.5">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort bar (feed tab only) */}
          {activeTab === 'feed' && (
            <motion.div className="flex gap-2" {...fadeInUp}>
              {[
                { key: 'latest', label: 'Latest', icon: Clock },
                { key: 'trending', label: 'Trending', icon: TrendingUp },
                { key: 'liked', label: 'Most Liked', icon: Heart },
                { key: 'commented', label: 'Most Discussed', icon: MessageCircle },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSortChange(key)}
                  className="gap-1.5 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </motion.div>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'feed' && (
              <motion.div key="feed" {...fadeInUp}>
                <PostFeed
                  posts={posts}
                  loading={feedLoading}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                />
              </motion.div>
            )}

            {activeTab === 'trending' && (
              <motion.div key="trending" {...fadeInUp}>
                <PostFeed
                  posts={trendingPosts}
                  loading={false}
                  hasMore={false}
                  onLoadMore={() => {}}
                />
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div key="chat" {...fadeInUp}>
                <LiveChat />
              </motion.div>
            )}

            {activeTab === 'leaderboard' && (
              <motion.div key="leaderboard" {...fadeInUp}>
                <div className="space-y-3">
                  {leaderboard.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
                    >
                      <span className="text-2xl font-bold text-muted-foreground w-8 text-center">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {entry.displayName || entry.email}
                          </span>
                          <span className="text-lg">{entry.level.badge}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.level.label} · {entry.reputationScore} pts
                        </p>
                      </div>
                      {i < 3 && (
                        <span className="text-2xl">
                          {['🥇', '🥈', '🥉'][i]}
                        </span>
                      )}
                    </motion.div>
                  ))}
                  {leaderboard.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No leaders yet. Start posting to climb the ranks!
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden xl:block w-72 shrink-0 border-l border-border">
        <RightSidebar />
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
      />
    </div>
  );
}
