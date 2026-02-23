'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getPnLColor } from '@/lib/utils/formatters';

interface Position {
    id: string;
    instrument: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    stopLoss: number;
    takeProfit: number;
    entryTime: string;
}

interface PositionsPanelProps {
    positions: Position[];
    currentPrice: number;
}

export default function PositionsPanel({ positions, currentPrice }: PositionsPanelProps) {
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Open Positions</h3>
                <Badge variant="secondary" className="text-xs">
                    {positions.length}
                </Badge>
            </div>

            {positions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                    No open positions
                </div>
            ) : (
                <div className="space-y-2">
                    {positions.map((position) => {
                        const pnl = position.direction === 'LONG'
                            ? (currentPrice - position.entryPrice) * position.quantity
                            : (position.entryPrice - currentPrice) * position.quantity;

                        return (
                            <div
                                key={position.id}
                                className="rounded-lg border p-3 space-y-2 hover:bg-accent/50 transition-smooth"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{position.instrument}</span>
                                        <Badge
                                            variant="outline"
                                            className={position.direction === 'LONG' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}
                                        >
                                            {position.direction}
                                        </Badge>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Entry</span>
                                        <p className="font-mono font-medium">{formatCurrency(position.entryPrice)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Qty</span>
                                        <p className="font-mono font-medium">{position.quantity}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">SL</span>
                                        <p className="font-mono font-medium text-red-400">{formatCurrency(position.stopLoss)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">TP</span>
                                        <p className="font-mono font-medium text-green-400">{formatCurrency(position.takeProfit)}</p>
                                    </div>
                                </div>

                                <div className={`text-right text-sm font-semibold font-mono ${getPnLColor(pnl)}`}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
