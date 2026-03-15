'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import { useSyncGroups } from '@/hooks/useTradeSync';
import { useSyncSocket } from '@/hooks/useSyncSocket';
import { fadeIn } from '@/lib/utils/motion';
import TradeSyncOverview from '@/components/trade-sync/TradeSyncOverview';
import TradeSyncSetup from '@/components/trade-sync/TradeSyncSetup';
import TradeSyncDashboard from '@/components/trade-sync/TradeSyncDashboard';

export default function TradeSyncPage() {
  const { view, activeGroupId, setSyncGroups } = useTradeSyncStore();
  const { data: groups, isLoading } = useSyncGroups();

  useSyncSocket(activeGroupId);

  useEffect(() => {
    if (groups) {
      setSyncGroups(groups);
    }
  }, [groups, setSyncGroups]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-3xl font-bold">Trade Sync</h1>
        <p className="text-muted-foreground mt-1">
          Multi-account trade replication with real-time risk management
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TradeSyncOverview isLoading={isLoading} />
          </motion.div>
        )}

        {view === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TradeSyncSetup />
          </motion.div>
        )}

        {view === 'dashboard' && activeGroupId && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TradeSyncDashboard syncGroupId={activeGroupId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
