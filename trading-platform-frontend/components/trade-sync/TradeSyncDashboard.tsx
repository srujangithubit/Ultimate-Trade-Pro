'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import {
  useSyncGroup,
  useGroupPerformance,
} from '@/hooks/useTradeSync';
import SyncStatusBadge from './SyncStatusBadge';
import SlaveAccountCard from './SlaveAccountCard';
import AddSlaveModal from './AddSlaveModal';
import RiskConfigPanel from './RiskConfigPanel';
import ReplicationFeed from './ReplicationFeed';
import PerformanceComparison from './PerformanceComparison';
import LivePnLPanel from './LivePnLPanel';
import { fadeIn } from '@/lib/utils/motion';

interface TradeSyncDashboardProps {
  syncGroupId: string;
}

export default function TradeSyncDashboard({
  syncGroupId,
}: TradeSyncDashboardProps) {
  const { setView, setActiveGroupId, setAddSlaveOpen, liveEquity, socketConnected } =
    useTradeSyncStore();
  const { data: group, isLoading } = useSyncGroup(syncGroupId);
  const { data: performance } = useGroupPerformance(syncGroupId);

  const [riskSlaveId, setRiskSlaveId] = useState<string | null>(null);

  const handleBack = () => {
    setActiveGroupId(null);
    setView('overview');
  };

  if (isLoading || !group) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const master = group.masterAccount;
  const slaves = group.slaveAccounts;
  const masterLive = master ? liveEquity[master.id] : null;
  const masterEquity = Number(masterLive?.equity ?? master?.equity) || 0;
  const masterBalance = Number(masterLive?.balance ?? master?.balance) || 0;
  const masterPnL = Number(masterLive?.floatingPnL ?? master?.floatingPnL) || 0;

  const riskSlave = slaves.find((s) => s.id === riskSlaveId) ?? null;

  return (
    <motion.div {...fadeIn} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{group.name}</h2>
              <SyncStatusBadge status={group.status} />
            </div>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {group.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            {socketConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Offline</span>
              </>
            )}
          </div>
          <Button
            onClick={() => setAddSlaveOpen(true)}
            size="sm"
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Slave
          </Button>
        </div>
      </div>

      {/* Master Account Card */}
      {master && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {master.isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              Master: {master.displayName}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                {master.accountNumber} @ {master.brokerName}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Equity</div>
                <div className="text-lg font-mono font-semibold">
                  $
                  {masterEquity.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-lg font-mono font-semibold">
                  $
                  {masterBalance.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Floating PnL
                </div>
                <div
                  className={`text-lg font-mono font-semibold ${
                    masterPnL >= 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {masterPnL >= 0
                    ? '+'
                    : ''}
                  $
                  {Math.abs(masterPnL).toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="live-pnl" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live-pnl">
            Live P/L
          </TabsTrigger>
          <TabsTrigger value="slaves">
            Slave Accounts ({slaves.length})
          </TabsTrigger>
          <TabsTrigger value="feed">Replication Feed</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="live-pnl">
          <LivePnLPanel group={group} />
        </TabsContent>

        <TabsContent value="slaves">
          {slaves.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 space-y-3">
                <p className="text-muted-foreground text-sm">
                  No slave accounts yet. Add one to start replicating trades.
                </p>
                <Button
                  onClick={() => setAddSlaveOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Slave Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {slaves.map((slave, i) => (
                <SlaveAccountCard
                  key={slave.id}
                  slave={slave}
                  index={i}
                  onConfigOpen={(id) => setRiskSlaveId(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="feed">
          <ReplicationFeed />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceComparison performance={performance ?? null} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddSlaveModal syncGroupId={syncGroupId} />
      <RiskConfigPanel
        slave={riskSlave}
        open={!!riskSlaveId}
        onClose={() => setRiskSlaveId(null)}
      />
    </motion.div>
  );
}
