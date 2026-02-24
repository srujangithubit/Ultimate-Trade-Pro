/**
 * MT5LiveTrades - Displays open positions in a real-time table using shadcn/ui Table.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMT5 } from './MT5Context';

export default function MT5LiveTrades() {
  const { positions, refreshPositions, status } = useMT5();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (status.authenticated) {
      refreshPositions();
      const interval = setInterval(refreshPositions, 5000);
      return () => clearInterval(interval);
    }
  }, [status.authenticated, refreshPositions]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshPositions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!status.authenticated) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">
            Connect to MT5 to view live open positions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
  const buyCount = positions.filter(p => p.type_str === 'BUY').length;
  const sellCount = positions.filter(p => p.type_str === 'SELL').length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Open Positions</h3>
                {positions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {buyCount > 0 && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                        {buyCount}
                      </Badge>
                    )}
                    {sellCount > 0 && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                        <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                        {sellCount}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {positions.length} position{positions.length !== 1 ? 's' : ''} •{' '}
                Total P&L:{' '}
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleManualRefresh}
          >
            <RefreshCw className={`h-4 w-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <AnimatePresence mode="wait">
          {positions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Activity className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                No open positions
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
                    <TableHead>Ticket</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Open Price</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">TP</TableHead>
                    <TableHead className="text-right">Swap</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos, index) => (
                    <motion.tr
                      key={pos.ticket}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-mono text-xs">
                        {pos.ticket}
                      </TableCell>
                      <TableCell className="font-medium">{pos.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant={pos.type_str === 'BUY' ? 'default' : 'destructive'}
                          className={`text-[10px] px-1.5 py-0 ${
                            pos.type_str === 'BUY'
                              ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                          }`}
                        >
                          {pos.type_str}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{pos.volume}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {pos.price_open}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {pos.price_current}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {pos.sl || '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {pos.tp || '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {pos.swap.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          pos.profit >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {pos.profit >= 0 ? '+' : ''}
                        {pos.profit.toFixed(2)}
                      </TableCell>
                    </motion.tr>
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
