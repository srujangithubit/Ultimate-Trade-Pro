'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Repeat2, Loader2 } from 'lucide-react';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import SyncGroupCard from './SyncGroupCard';
import { staggerContainer, staggerItem } from '@/lib/utils/motion';

interface TradeSyncOverviewProps {
  isLoading: boolean;
}

export default function TradeSyncOverview({
  isLoading,
}: TradeSyncOverviewProps) {
  const { syncGroups, setView } = useTradeSyncStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (syncGroups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Repeat2 className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">No Sync Groups Yet</h3>
            <p className="text-muted-foreground max-w-md">
              Create your first sync group to start replicating trades from a
              master account to one or more slave accounts in real-time.
            </p>
          </div>
          <Button onClick={() => setView('setup')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Sync Group
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Sync Groups ({syncGroups.length})
        </h2>
        <Button onClick={() => setView('setup')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Sync Group
        </Button>
      </div>

      <motion.div
        {...staggerContainer}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {syncGroups.map((group, i) => (
          <motion.div key={group.id} {...staggerItem}>
            <SyncGroupCard group={group} index={i} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
