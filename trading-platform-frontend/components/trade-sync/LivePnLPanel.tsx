    'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Crown,
  Users,
  Minus,
} from 'lucide-react';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import type { SyncGroup, LivePosition } from '@/types/trade-sync';

interface LivePnLPanelProps {
  group: SyncGroup;
}

function PnLValue({
  value,
  size = 'sm',
}: {
  value: number;
  size?: 'sm' | 'lg' | 'xl';
}) {
  const isPositive = value > 0;
  const isZero = value === 0;
  const color = isZero
    ? 'text-muted-foreground'
    : isPositive
      ? 'text-emerald-500'
      : 'text-red-500';
  const sizeClass =
    size === 'xl'
      ? 'text-3xl'
      : size === 'lg'
        ? 'text-xl'
        : 'text-sm';

  return (
    <span className={`font-mono font-semibold ${color} ${sizeClass}`}>
      {isPositive ? '+' : ''}
      ${Math.abs(value).toFixed(2)}
    </span>
  );
}

function PositionRow({ position }: { position: LivePosition }) {
  const isBuy = position.direction === 'BUY';
  const pnlWithSwap = position.profit + position.swap;

  return (
    <TableRow className="group hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">{position.symbol}</TableCell>
      <TableCell>
        <Badge
          variant={isBuy ? 'default' : 'destructive'}
          className={`text-xs px-1.5 py-0 ${
            isBuy
              ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/30'
              : 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/30'
          }`}
        >
          {position.direction}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {position.volume.toFixed(2)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {position.priceOpen.toFixed(position.symbol.includes('JPY') ? 3 : 5)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {position.priceCurrent.toFixed(
          position.symbol.includes('JPY') ? 3 : 5,
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {position.sl > 0
          ? position.sl.toFixed(position.symbol.includes('JPY') ? 3 : 5)
          : '—'}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {position.tp > 0
          ? position.tp.toFixed(position.symbol.includes('JPY') ? 3 : 5)
          : '—'}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {position.swap !== 0 ? position.swap.toFixed(2) : '—'}
      </TableCell>
      <TableCell className="text-right">
        <PnLValue value={pnlWithSwap} />
      </TableCell>
    </TableRow>
  );
}

function AccountPositionsTable({
  label,
  icon,
  accountId,
  displayName,
  accountNumber,
}: {
  label: string;
  icon: React.ReactNode;
  accountId: string;
  displayName: string;
  accountNumber: string;
}) {
  const { livePositions, liveEquity } = useTradeSyncStore();
  const posData = livePositions[accountId];
  const equity = liveEquity[accountId];

  const positions = posData?.positions ?? [];
  const totalPnL = posData?.totalPnL ?? 0;
  const lastUpdate = posData?.timestamp
    ? new Date(posData.timestamp)
    : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{label}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {displayName} · {accountNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {equity && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Equity:{' '}
                  <span className="font-mono font-medium text-foreground">
                    $
                    {Number(equity.equity).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </span>
                <span>
                  Balance:{' '}
                  <span className="font-mono font-medium text-foreground">
                    $
                    {Number(equity.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </span>
              </div>
            )}
            {lastUpdate && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                <span className="text-[10px] text-muted-foreground">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {positions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Minus className="h-4 w-4 mr-2" />
            No open positions
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-8 text-xs">Symbol</TableHead>
                    <TableHead className="h-8 text-xs">Side</TableHead>
                    <TableHead className="h-8 text-xs">Lots</TableHead>
                    <TableHead className="h-8 text-xs">Open</TableHead>
                    <TableHead className="h-8 text-xs">Current</TableHead>
                    <TableHead className="h-8 text-xs">SL</TableHead>
                    <TableHead className="h-8 text-xs">TP</TableHead>
                    <TableHead className="h-8 text-xs">Swap</TableHead>
                    <TableHead className="h-8 text-xs text-right">
                      P/L
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {positions.map((pos) => (
                      <motion.tr
                        key={pos.ticket}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="group hover:bg-muted/50 transition-colors border-b last:border-b-0"
                      >
                        <TableCell className="font-medium text-sm py-2">
                          {pos.symbol}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant={
                              pos.direction === 'BUY'
                                ? 'default'
                                : 'destructive'
                            }
                            className={`text-xs px-1.5 py-0 ${
                              pos.direction === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/30'
                                : 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/30'
                            }`}
                          >
                            {pos.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs py-2">
                          {pos.volume.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs py-2">
                          {pos.priceOpen.toFixed(
                            pos.symbol.includes('JPY') ? 3 : 5,
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs py-2">
                          {pos.priceCurrent.toFixed(
                            pos.symbol.includes('JPY') ? 3 : 5,
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground py-2">
                          {pos.sl > 0
                            ? pos.sl.toFixed(
                                pos.symbol.includes('JPY') ? 3 : 5,
                              )
                            : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground py-2">
                          {pos.tp > 0
                            ? pos.tp.toFixed(
                                pos.symbol.includes('JPY') ? 3 : 5,
                              )
                            : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground py-2">
                          {pos.swap !== 0 ? pos.swap.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <PnLValue value={pos.profit + pos.swap} />
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {/* Total row */}
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-muted-foreground">
                {positions.length} position{positions.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Total P/L:
                </span>
                <PnLValue value={totalPnL} size="lg" />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LivePnLPanel({ group }: LivePnLPanelProps) {
  const { livePositions } = useTradeSyncStore();
  const master = group.masterAccount;
  const slaves = group.slaveAccounts;

  // Calculate combined P/L across all accounts
  const combinedPnL = useMemo(() => {
    let total = 0;
    if (master) {
      const mp = livePositions[master.id];
      if (mp) total += mp.totalPnL;
    }
    for (const slave of slaves) {
      const sp = livePositions[slave.id];
      if (sp) total += sp.totalPnL;
    }
    return total;
  }, [master, slaves, livePositions]);

  const totalPositions = useMemo(() => {
    let count = 0;
    if (master) {
      const mp = livePositions[master.id];
      if (mp) count += mp.positionCount;
    }
    for (const slave of slaves) {
      const sp = livePositions[slave.id];
      if (sp) count += sp.positionCount;
    }
    return count;
  }, [master, slaves, livePositions]);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <Card className="bg-gradient-to-r from-card to-muted/30 border">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Combined Floating P/L
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <PnLValue value={combinedPnL} size="xl" />
                  {combinedPnL !== 0 && (
                    combinedPnL > 0 ? (
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Open Positions</p>
              <p className="text-2xl font-bold font-mono">{totalPositions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Master positions */}
      {master && (
        <AccountPositionsTable
          label="Master Account"
          icon={<Crown className="h-4 w-4 text-amber-500" />}
          accountId={master.id}
          displayName={master.displayName}
          accountNumber={master.accountNumber}
        />
      )}

      {/* Slave positions */}
      {slaves.map((slave) => (
        <AccountPositionsTable
          key={slave.id}
          label="Slave Account"
          icon={<Users className="h-4 w-4 text-blue-500" />}
          accountId={slave.id}
          displayName={slave.displayName}
          accountNumber={slave.accountNumber}
        />
      ))}
    </div>
  );
}
