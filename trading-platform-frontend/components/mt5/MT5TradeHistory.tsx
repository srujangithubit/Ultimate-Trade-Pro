/**
 * MT5TradeHistory - Displays closed trades with day-range selector using shadcn/ui.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, History, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMT5 } from './MT5Context';
import type { MT5ClosedTrade } from '@/lib/types/mt5';

function formatTime(unix: number): string {
  if (!unix) return '—';
  const d = new Date(unix * 1000);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: number): string {
  return price.toFixed(5);
}

export default function MT5TradeHistory() {
  const { tradeHistory, refreshTradeHistory, status } = useMT5();
  const [days, setDays] = useState('30');

  useEffect(() => {
    if (status.authenticated) {
      refreshTradeHistory(parseInt(days, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.authenticated]);

  if (!status.authenticated) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">
            Connect to MT5 to view trade history.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProfit = tradeHistory.reduce((sum, t) => sum + t.profit, 0);
  const winCount = tradeHistory.filter((t) => t.profit > 0).length;
  const winRate =
    tradeHistory.length > 0
      ? ((winCount / tradeHistory.length) * 100).toFixed(1)
      : '0';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <History className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Trade History</h3>
                {tradeHistory.length > 0 && (
                  <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                    <Trophy className="h-2.5 w-2.5 mr-0.5" />
                    {winRate}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tradeHistory.length} trades • Win Rate: {winRate}% • Total P&L:{' '}
                <span
                  className={`font-semibold ${
                    totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {totalProfit >= 0 ? '+' : ''}
                  {totalProfit.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={days}
              onValueChange={(val) => {
                setDays(val);
                refreshTradeHistory(parseInt(val, 10));
              }}
            >
              <SelectTrigger className="h-8 w-25 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refreshTradeHistory(parseInt(days, 10))}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <AnimatePresence mode="wait">
          {tradeHistory.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <History className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                No closed trades found for the selected period
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead>Entry Time</TableHead>
                <TableHead>Exit Time</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Swap</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeHistory.map((t: MT5ClosedTrade) => (
                <TableRow key={`${t.ticket_in}-${t.ticket_out}`}>
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant={t.type === 'BUY' ? 'default' : 'destructive'}
                      className={`text-[10px] px-1.5 py-0 ${
                        t.type === 'BUY'
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                      }`}
                    >
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t.volume}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatPrice(t.entry_price)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatPrice(t.exit_price)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(t.entry_time)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(t.exit_time)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      t.profit >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {t.profit >= 0 ? '+' : ''}
                    {t.profit.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {t.swap.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {t.commission.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
