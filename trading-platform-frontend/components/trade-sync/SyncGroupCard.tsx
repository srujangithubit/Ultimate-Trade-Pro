'use client';

import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Wifi,
  WifiOff,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import SyncStatusBadge from './SyncStatusBadge';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import { useDeleteSyncGroup } from '@/hooks/useTradeSync';
import type { SyncGroup } from '@/types/trade-sync';

interface SyncGroupCardProps {
  group: SyncGroup;
  index: number;
}

export default function SyncGroupCard({ group, index }: SyncGroupCardProps) {
  const { setActiveGroupId, setView } = useTradeSyncStore();
  const deleteMutation = useDeleteSyncGroup();

  const master = group.masterAccount;
  const slaveCount = group.slaveAccounts.length;
  const activeSlaves = group.slaveAccounts.filter(
    (s) => s.status === 'ACTIVE',
  ).length;

  const handleOpen = () => {
    setActiveGroupId(group.id);
    setView('dashboard');
  };

  const handleDelete = () => {
    if (
      confirm(
        `Delete sync group "${group.name}"? This will remove all slave accounts and replication history.`,
      )
    ) {
      deleteMutation.mutate(group.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="hover:border-primary/50 transition-colors group cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">{group.name}</CardTitle>
            {group.description && (
              <p className="text-sm text-muted-foreground">
                {group.description}
              </p>
            )}
          </div>
          <SyncStatusBadge status={group.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master info */}
          {master && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {master.isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {master.displayName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {master.accountNumber} @ {master.brokerName}
              </span>
              {master.equity > 0 && (
                <span className="ml-auto text-sm font-mono">
                  ${master.equity.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
          )}

          {/* Slave count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {activeSlaves}/{slaveCount} slaves active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleteMutation.isPending}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleOpen}
                className="gap-1"
              >
                Open
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
