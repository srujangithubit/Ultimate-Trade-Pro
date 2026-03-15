'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useRegisterSlave } from '@/hooks/useTradeSync';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import type { RiskMode } from '@/types/trade-sync';

interface AddSlaveModalProps {
  syncGroupId: string;
}

export default function AddSlaveModal({
  syncGroupId,
}: AddSlaveModalProps) {
  const { addSlaveOpen, setAddSlaveOpen } = useTradeSyncStore();
  const registerSlave = useRegisterSlave();

  const [form, setForm] = useState({
    displayName: '',
    accountNumber: '',
    brokerName: '',
    serverName: '',
    riskMode: 'LOT_MULTIPLIER' as RiskMode,
    lotMultiplier: 1,
    fixedLot: 0.1,
    maxLotSize: 10,
    minLotSize: 0.01,
    reverseDirection: false,
    copyStopLoss: true,
    copyTakeProfit: true,
    slippage: 5,
    maxDailyDrawdownPct: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await registerSlave.mutateAsync({
      syncGroupId,
      displayName: form.displayName,
      accountNumber: form.accountNumber,
      brokerName: form.brokerName,
      serverName: form.serverName,
      riskConfig: {
        mode: form.riskMode,
        lotMultiplier: form.lotMultiplier,
        fixedLot: form.fixedLot,
        maxLotSize: form.maxLotSize,
        minLotSize: form.minLotSize,
        reverseDirection: form.reverseDirection,
        copyStopLoss: form.copyStopLoss,
        copyTakeProfit: form.copyTakeProfit,
        slippage: form.slippage,
      },
      maxDailyDrawdownPct: form.maxDailyDrawdownPct,
    });

    setAddSlaveOpen(false);
    setForm({
      displayName: '',
      accountNumber: '',
      brokerName: '',
      serverName: '',
      riskMode: 'LOT_MULTIPLIER',
      lotMultiplier: 1,
      fixedLot: 0.1,
      maxLotSize: 10,
      minLotSize: 0.01,
      reverseDirection: false,
      copyStopLoss: true,
      copyTakeProfit: true,
      slippage: 5,
      maxDailyDrawdownPct: 5,
    });
  };

  const update = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid =
    form.displayName.length >= 2 &&
    form.accountNumber.length > 0 &&
    form.brokerName.length > 0 &&
    form.serverName.length > 0;

  return (
    <Dialog open={addSlaveOpen} onOpenChange={setAddSlaveOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Slave Account</DialogTitle>
          <DialogDescription>
            Register a new slave account to receive replicated trades.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Info */}
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-2 col-span-2">
              <Label>Display Name *</Label>
              <Input
                placeholder="Sub Account #1"
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input
                placeholder="87654321"
                value={form.accountNumber}
                onChange={(e) => update('accountNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Broker *</Label>
              <Input
                placeholder="ICMarkets"
                value={form.brokerName}
                onChange={(e) => update('brokerName', e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Server *</Label>
              <Input
                placeholder="ICMarketsSC-Demo"
                value={form.serverName}
                onChange={(e) => update('serverName', e.target.value)}
              />
            </div>
          </div>

          {/* Risk Config */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Risk Configuration
            </h4>
            <div className="space-y-2">
              <Label>Risk Mode</Label>
              <Select
                value={form.riskMode}
                onValueChange={(v) => update('riskMode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOT_MULTIPLIER">
                    Lot Multiplier
                  </SelectItem>
                  <SelectItem value="FIXED_LOT">Fixed Lot</SelectItem>
                  <SelectItem value="RISK_PERCENTAGE">
                    Risk %
                  </SelectItem>
                  <SelectItem value="EQUITY_PERCENTAGE">
                    Equity %
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.riskMode === 'LOT_MULTIPLIER' && (
              <div className="space-y-2">
                <Label>Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={form.lotMultiplier}
                  onChange={(e) =>
                    update('lotMultiplier', parseFloat(e.target.value) || 1)
                  }
                />
              </div>
            )}

            {form.riskMode === 'FIXED_LOT' && (
              <div className="space-y-2">
                <Label>Fixed Lot</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.fixedLot}
                  onChange={(e) =>
                    update('fixedLot', parseFloat(e.target.value) || 0.01)
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Max Daily Drawdown %</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={form.maxDailyDrawdownPct}
                  onChange={(e) =>
                    update(
                      'maxDailyDrawdownPct',
                      parseFloat(e.target.value) || 5,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Slippage (pts)</Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={form.slippage}
                  onChange={(e) =>
                    update('slippage', parseInt(e.target.value) || 5)
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Reverse Direction</Label>
                <Switch
                  checked={form.reverseDirection}
                  onCheckedChange={(v: boolean) => update('reverseDirection', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Copy Stop Loss</Label>
                <Switch
                  checked={form.copyStopLoss}
                  onCheckedChange={(v: boolean) => update('copyStopLoss', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Copy Take Profit</Label>
                <Switch
                  checked={form.copyTakeProfit}
                  onCheckedChange={(v: boolean) => update('copyTakeProfit', v)}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || registerSlave.isPending}
          >
            {registerSlave.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Slave Account'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
