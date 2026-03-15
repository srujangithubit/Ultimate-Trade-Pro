'use client';

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateRiskConfig } from '@/hooks/useTradeSync';
import type { SlaveAccount, RiskMode } from '@/types/trade-sync';

interface RiskConfigPanelProps {
  slave: SlaveAccount | null;
  open: boolean;
  onClose: () => void;
}

export default function RiskConfigPanel({
  slave,
  open,
  onClose,
}: RiskConfigPanelProps) {
  const updateConfig = useUpdateRiskConfig();

  const initialForm = useMemo(() => ({
    mode: (slave?.riskMode ?? 'LOT_MULTIPLIER') as RiskMode,
    lotMultiplier: slave?.lotMultiplier ?? 1,
    fixedLot: slave?.fixedLot ?? 0.1,
    riskPercentage: slave?.riskPercentage ?? 1,
    equityPercentage: slave?.equityPercentage ?? 2,
    maxLotSize: slave?.maxLotSize ?? 10,
    minLotSize: slave?.minLotSize ?? 0.01,
    reverseDirection: slave?.reverseDirection ?? false,
    copyStopLoss: slave?.copyStopLoss ?? true,
    copyTakeProfit: slave?.copyTakeProfit ?? true,
    slippage: slave?.slippagePoints ?? 5,
  }), [slave]);

  const [form, setForm] = useState(initialForm);

  const handleSave = async () => {
    if (!slave) return;
    await updateConfig.mutateAsync({
      slaveId: slave.id,
      config: form,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Risk Configuration</SheetTitle>
          <SheetDescription>
            {slave?.displayName ?? 'Slave Account'} — {slave?.accountNumber}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Risk Mode */}
          <div className="space-y-2">
            <Label>Risk Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, mode: v as RiskMode }))
              }
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
                  Risk Percentage
                </SelectItem>
                <SelectItem value="EQUITY_PERCENTAGE">
                  Equity Percentage
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic fields based on mode */}
          {form.mode === 'LOT_MULTIPLIER' && (
            <div className="space-y-2">
              <Label>Lot Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={form.lotMultiplier}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    lotMultiplier: parseFloat(e.target.value) || 1,
                  }))
                }
              />
            </div>
          )}

          {form.mode === 'FIXED_LOT' && (
            <div className="space-y-2">
              <Label>Fixed Lot Size</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={form.fixedLot}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    fixedLot: parseFloat(e.target.value) || 0.01,
                  }))
                }
              />
            </div>
          )}

          {form.mode === 'RISK_PERCENTAGE' && (
            <div className="space-y-2">
              <Label>Risk % per Trade</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={form.riskPercentage}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    riskPercentage: parseFloat(e.target.value) || 1,
                  }))
                }
              />
            </div>
          )}

          {form.mode === 'EQUITY_PERCENTAGE' && (
            <div className="space-y-2">
              <Label>Max Equity %</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={form.equityPercentage}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    equityPercentage: parseFloat(e.target.value) || 2,
                  }))
                }
              />
            </div>
          )}

          {/* Lot limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Lot</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.minLotSize}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    minLotSize: parseFloat(e.target.value) || 0.01,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Lot</Label>
              <Input
                type="number"
                step="0.1"
                min="0.01"
                value={form.maxLotSize}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    maxLotSize: parseFloat(e.target.value) || 10,
                  }))
                }
              />
            </div>
          </div>

          {/* Slippage */}
          <div className="space-y-2">
            <Label>Max Slippage (points)</Label>
            <Input
              type="number"
              min="0"
              max="50"
              value={form.slippage}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  slippage: parseInt(e.target.value) || 5,
                }))
              }
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Reverse Direction</Label>
              <Switch
                checked={form.reverseDirection}
                onCheckedChange={(v: boolean) =>
                  setForm((p) => ({ ...p, reverseDirection: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Copy Stop Loss</Label>
              <Switch
                checked={form.copyStopLoss}
                onCheckedChange={(v: boolean) =>
                  setForm((p) => ({ ...p, copyStopLoss: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Copy Take Profit</Label>
              <Switch
                checked={form.copyTakeProfit}
                onCheckedChange={(v: boolean) =>
                  setForm((p) => ({ ...p, copyTakeProfit: v }))
                }
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
