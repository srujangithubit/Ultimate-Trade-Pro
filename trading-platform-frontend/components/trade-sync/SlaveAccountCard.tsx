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
  Wifi,
  WifiOff,
  Pause,
  Play,
  Trash2,
  Settings,
} from 'lucide-react';
import SyncStatusBadge from './SyncStatusBadge';
import DrawdownGauge from './DrawdownGauge';
import KillSwitchButton from './KillSwitchButton';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import {
  usePauseSlave,
  useResumeSlave,
  useDeleteSlave,
} from '@/hooks/useTradeSync';
import type { SlaveAccount } from '@/types/trade-sync';

interface SlaveAccountCardProps {
  slave: SlaveAccount;
  index: number;
  onConfigOpen: (slaveId: string) => void;
}

export default function SlaveAccountCard({
  slave,
  index,
  onConfigOpen,
}: SlaveAccountCardProps) {
  const { liveEquity, livePositions } = useTradeSyncStore();
  const pauseMutation = usePauseSlave();
  const resumeMutation = useResumeSlave();
  const deleteMutation = useDeleteSlave();

  const live = liveEquity[slave.id];
  const equity = Number(live?.equity ?? slave.equity) || 0;
  const balance = Number(live?.balance ?? slave.balance) || 0;
  const positionPnL =
    livePositions[slave.id] && Number.isFinite(livePositions[slave.id].totalPnL)
      ? Number(livePositions[slave.id].totalPnL)
      : 0;
  const floatingPnL =
    Number(live?.floatingPnL ?? slave.floatingPnL) || positionPnL;
  const isConnected = Boolean(slave.isConnected || live);

  const handleDelete = () => {
    if (
      confirm(
        `Remove slave "${slave.displayName}" from this sync group?`,
      )
    ) {
      deleteMutation.mutate(slave.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Card
        className={`transition-colors ${
          slave.killSwitchActive ? 'border-destructive/50 bg-destructive/5' : ''
        }`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <CardTitle className="text-base">{slave.displayName}</CardTitle>
          </div>
          <SyncStatusBadge status={slave.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account info */}
          <div className="text-xs text-muted-foreground">
            {slave.accountNumber} @ {slave.brokerName}
            {slave.riskMode ? ` · ${slave.riskMode.replace('_', ' ')}` : ''}
            {slave.riskMode === 'LOT_MULTIPLIER' && ` × ${slave.lotMultiplier}`}
          </div>

          {/* Equity & Drawdown */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                Equity:{' '}
                <span className="font-mono">
                  ${equity.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Balance:{' '}
                <span className="font-mono">
                  ${balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div
                className={`text-sm font-mono ${
                  floatingPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                PnL: {floatingPnL >= 0 ? '+' : ''}
                {floatingPnL.toFixed(2)}
              </div>
            </div>
            <DrawdownGauge
              current={slave.dailyDrawdownPct}
              max={slave.maxDailyDrawdownPct}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {slave.status === 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => pauseMutation.mutate(slave.id)}
                disabled={pauseMutation.isPending}
              >
                <Pause className="h-3 w-3" />
                Pause
              </Button>
            )}
            {slave.status === 'PAUSED' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => resumeMutation.mutate(slave.id)}
                disabled={resumeMutation.isPending}
              >
                <Play className="h-3 w-3" />
                Resume
              </Button>
            )}
            <KillSwitchButton
              slaveId={slave.id}
              isActive={slave.killSwitchActive}
              slaveName={slave.displayName}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onConfigOpen(slave.id)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
