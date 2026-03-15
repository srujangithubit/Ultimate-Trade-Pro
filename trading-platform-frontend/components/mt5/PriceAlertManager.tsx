/**
 * PriceAlertManager - UI for creating, viewing and deleting price alerts.
 * Renders as a collapsible card within the MT5 Dashboard.
 */

'use client';

import React, { useState } from 'react';
import { Bell, BellRing, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePriceAlerts, type PriceAlert } from '@/lib/hooks/usePriceAlerts';

const POPULAR_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US30', 'NAS100',
  'USDCHF', 'AUDUSD', 'USDCAD', 'GBPJPY',
];

export default function PriceAlertManager() {
  const { alerts, createAlert, deleteAlert } = usePriceAlerts();
  const [isCreating, setIsCreating] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    const trimSymbol = symbol.trim().toUpperCase();
    const numPrice = parseFloat(price);
    if (!trimSymbol || isNaN(numPrice) || numPrice <= 0) return;

    setSubmitting(true);
    try {
      await createAlert(trimSymbol, numPrice, direction, note.trim() || undefined);
      setSymbol('');
      setPrice('');
      setNote('');
      setIsCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-amber-500" />
            Price Alerts
            {alerts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> New Alert</>}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Create form */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Symbol (e.g. XAUUSD)"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      list="alert-symbols"
                    />
                    <datalist id="alert-symbols">
                      {POPULAR_SYMBOLS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div className="w-36">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Select
                    value={direction}
                    onValueChange={(v) => setDirection(v as 'above' | 'below')}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                          Price Above
                        </span>
                      </SelectItem>
                      <SelectItem value="below">
                        <span className="flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          Price Below
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleCreate}
                  disabled={!symbol.trim() || !price || submitting}
                >
                  <Bell className="h-4 w-4" />
                  {submitting ? 'Creating...' : 'Set Alert'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active alerts list */}
        {alerts.length === 0 && !isCreating ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active alerts. Click &quot;New Alert&quot; to set one up.
          </p>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({
  alert,
  onDelete,
}: {
  alert: PriceAlert;
  onDelete: (id: string) => void;
}) {
  const isAbove = alert.direction === 'above';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            isAbove ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}
        >
          {isAbove ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{alert.symbol}</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 ${
                isAbove
                  ? 'border-green-500/30 text-green-500'
                  : 'border-red-500/30 text-red-500'
              }`}
            >
              {isAbove ? '▲ Above' : '▼ Below'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              @ {alert.targetPrice}
            </span>
            {alert.note && (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                — {alert.note}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(alert.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  );
}
