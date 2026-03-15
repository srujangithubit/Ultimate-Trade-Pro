'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Activity } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCommunity } from '@/lib/hooks/useCommunity';
import type { CommunityPost, LeaderboardEntry } from '@/lib/types/community';

export default function RightSidebar() {
  const { fetchTrending, fetchLeaderboard } = useCommunity();
  const [trending, setTrending] = useState<CommunityPost[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchTrending().then((data) => setTrending(data.slice(0, 5)));
    fetchLeaderboard().then((data) => setLeaders(data.slice(0, 5)));
  }, [fetchTrending, fetchLeaderboard]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Trending Posts */}
      <Card>
        <CardHeader className="py-3 px-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Trending Now
          </h3>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {trending.map((post, i) => (
            <motion.a
              key={post.id}
              href={`/community/${post.id}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted transition-colors"
            >
              <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {post.symbol} · {post.direction.toLowerCase()}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {post.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {post.likesCount} likes
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {post.commentsCount} comments
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
          {trending.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No trending posts yet
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Top Traders */}
      <Card>
        <CardHeader className="py-3 px-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top Traders
          </h3>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {leaders.map((entry, i) => {
            const initials = (entry.displayName || entry.email || '??')
              .substring(0, 2)
              .toUpperCase();
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2.5 p-2 rounded-md"
              >
                <span className="text-sm">{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}</span>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {entry.displayName || entry.email}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">{entry.level.badge}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.reputationScore} pts
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {leaders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No traders yet
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Community Stats */}
      <Card>
        <CardHeader className="py-3 px-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Community Stats
          </h3>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Active Now', value: '—', icon: Users },
              { label: 'Today', value: '—', icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="text-center p-2 rounded-md bg-muted/50"
              >
                <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
