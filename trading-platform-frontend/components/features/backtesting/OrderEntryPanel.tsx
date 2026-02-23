'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/formatters';

interface OrderEntryPanelProps {
    sessionId: string;
    currentPrice: number;
}

export default function OrderEntryPanel({ currentPrice }: OrderEntryPanelProps) {
    const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState('MARKET');
    const [quantity, setQuantity] = useState('1');
    const [limitPrice, setLimitPrice] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');

    const handleSubmit = () => {
        console.log('Order submitted:', {
            direction,
            orderType,
            quantity: parseFloat(quantity),
            price: orderType === 'MARKET' ? currentPrice : parseFloat(limitPrice),
            stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
            takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        });
    };

    return (
        <div className="border rounded-xl bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Order Entry</h3>
                <span className="text-xs text-muted-foreground font-mono">
                    {formatCurrency(currentPrice)}
                </span>
            </div>

            {/* Buy / Sell tabs */}
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant={direction === 'BUY' ? 'default' : 'outline'}
                    onClick={() => setDirection('BUY')}
                    className={direction === 'BUY' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                >
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Buy Long
                </Button>
                <Button
                    variant={direction === 'SELL' ? 'default' : 'outline'}
                    onClick={() => setDirection('SELL')}
                    className={direction === 'SELL' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                >
                    <ArrowDown className="h-4 w-4 mr-1" />
                    Sell Short
                </Button>
            </div>

            {/* Order type */}
            <div className="space-y-2">
                <Label className="text-xs">Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="MARKET">Market</SelectItem>
                        <SelectItem value="LIMIT">Limit</SelectItem>
                        <SelectItem value="STOP">Stop</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
                <Label className="text-xs">Quantity</Label>
                <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min={1}
                    className="h-9 font-mono"
                />
            </div>

            {/* Limit price (conditional) */}
            {orderType !== 'MARKET' && (
                <div className="space-y-2">
                    <Label className="text-xs">{orderType === 'LIMIT' ? 'Limit' : 'Stop'} Price</Label>
                    <Input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={currentPrice.toString()}
                        className="h-9 font-mono"
                    />
                </div>
            )}

            {/* Stop Loss / Take Profit */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-xs">Stop Loss</Label>
                    <Input
                        type="number"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder="Optional"
                        className="h-9 font-mono text-xs"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Take Profit</Label>
                    <Input
                        type="number"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        placeholder="Optional"
                        className="h-9 font-mono text-xs"
                    />
                </div>
            </div>

            {/* Submit */}
            <Button
                onClick={handleSubmit}
                className={`w-full ${direction === 'BUY'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                    } text-white`}
            >
                {direction === 'BUY' ? 'Place Buy Order' : 'Place Sell Order'}
            </Button>
        </div>
    );
}
