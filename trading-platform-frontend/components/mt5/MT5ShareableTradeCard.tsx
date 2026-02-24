/**
 * MT5ShareableTradeCard — A beautiful shareable card for an open position or closed trade.
 * Captures the card as a downloadable PNG image via html-to-image.
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
    ArrowUpRight,
    ArrowDownRight,
    Share2,
    Download,
    Copy,
    TrendingUp,
    TrendingDown,
    Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

// ─── Types ───

export interface ShareableOpenTrade {
    kind: 'open';
    ticket: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    priceOpen: number;
    priceCurrent: number;
    profit: number;
    swap: number;
    sl: number;
    tp: number;
    openTime: number; // unix seconds
    accountName?: string;
}

export interface ShareableClosedTrade {
    kind: 'closed';
    ticketIn: number;
    ticketOut: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    swap: number;
    commission: number;
    entryTime: number;
    exitTime: number;
    accountName?: string;
}

export type ShareableTrade = ShareableOpenTrade | ShareableClosedTrade;

function formatTime(unix: number): string {
    if (!unix) return '—';
    const d = new Date(unix * 1000);
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPrice(price: number): string {
    if (!price) return '—';
    return price >= 10 ? price.toFixed(2) : price.toFixed(5);
}

function getDuration(startUnix: number, endUnix: number): string {
    const diffMs = (endUnix - startUnix) * 1000;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs < 24) return `${hrs}h ${remMins}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
}

// ─── The Card (rendered in dialog) ───

function TradeCardContent({ trade }: { trade: ShareableTrade }) {
    const isBuy = trade.type === 'BUY';
    const isProfit = trade.profit >= 0;
    const isOpen = trade.kind === 'open';

    return (
        <div className="rounded-2xl overflow-hidden border border-border/60 shadow-xl bg-linear-to-br from-card via-card to-accent/10 w-full max-w-md mx-auto">
            {/* Header stripe */}
            <div className={`h-1.5 w-full ${isProfit ? 'bg-linear-to-r from-green-500 to-emerald-400' : 'bg-linear-to-r from-red-500 to-orange-400'}`} />

            <div className="p-5 space-y-4">
                {/* Top row: Symbol + status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isBuy ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
                            {isBuy ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{trade.symbol}</h3>
                            <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isBuy
                                    ? 'border-green-500/30 text-green-600 dark:text-green-400'
                                    : 'border-red-500/30 text-red-600 dark:text-red-400'
                                    }`}>
                                    {trade.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{trade.volume} lots</span>
                            </div>
                        </div>
                    </div>
                    <Badge className={`text-xs px-2.5 py-0.5 ${isOpen
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        : isProfit
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                        }`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                    </Badge>
                </div>

                {/* P&L Hero */}
                <div className="text-center py-3">
                    <div className="flex items-center justify-center gap-1.5">
                        {isProfit ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                        <span className={`text-3xl font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? '+' : ''}{trade.profit.toFixed(2)}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Profit / Loss</p>
                </div>

                {/* Price grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-accent/50 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entry Price</p>
                        <p className="text-sm font-semibold font-mono mt-0.5">
                            {isOpen ? formatPrice((trade as ShareableOpenTrade).priceOpen) : formatPrice((trade as ShareableClosedTrade).entryPrice)}
                        </p>
                    </div>
                    <div className="rounded-xl bg-accent/50 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {isOpen ? 'Current Price' : 'Exit Price'}
                        </p>
                        <p className="text-sm font-semibold font-mono mt-0.5">
                            {isOpen ? formatPrice((trade as ShareableOpenTrade).priceCurrent) : formatPrice((trade as ShareableClosedTrade).exitPrice)}
                        </p>
                    </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    {isOpen && (trade as ShareableOpenTrade).sl > 0 && (
                        <div className="rounded-lg bg-red-500/5 p-2">
                            <p className="text-[10px] text-muted-foreground">SL</p>
                            <p className="text-xs font-semibold font-mono">{formatPrice((trade as ShareableOpenTrade).sl)}</p>
                        </div>
                    )}
                    {isOpen && (trade as ShareableOpenTrade).tp > 0 && (
                        <div className="rounded-lg bg-green-500/5 p-2">
                            <p className="text-[10px] text-muted-foreground">TP</p>
                            <p className="text-xs font-semibold font-mono">{formatPrice((trade as ShareableOpenTrade).tp)}</p>
                        </div>
                    )}
                    <div className="rounded-lg bg-accent/30 p-2">
                        <p className="text-[10px] text-muted-foreground">Swap</p>
                        <p className="text-xs font-semibold">{trade.swap.toFixed(2)}</p>
                    </div>
                    {!isOpen && (
                        <div className="rounded-lg bg-accent/30 p-2">
                            <p className="text-[10px] text-muted-foreground">Commission</p>
                            <p className="text-xs font-semibold">{(trade as ShareableClosedTrade).commission.toFixed(2)}</p>
                        </div>
                    )}
                </div>

                {/* Time info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
                    <Clock className="h-3.5 w-3.5" />
                    {isOpen ? (
                        <span>Opened {formatTime((trade as ShareableOpenTrade).openTime)}</span>
                    ) : (
                        <span>
                            {getDuration((trade as ShareableClosedTrade).entryTime, (trade as ShareableClosedTrade).exitTime)}
                            {' • '}
                            {formatTime((trade as ShareableClosedTrade).entryTime)} → {formatTime((trade as ShareableClosedTrade).exitTime)}
                        </span>
                    )}
                </div>

                {/* Brand footer */}
                <div className="flex items-center justify-between pt-1 border-t">
                    <p className="text-[10px] text-muted-foreground">
                        {trade.accountName || 'MT5 Live'} • TradePro
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        #{isOpen ? (trade as ShareableOpenTrade).ticket : (trade as ShareableClosedTrade).ticketIn}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Share Dialog ───

export default function MT5ShareableTradeCard({
    trade,
    open,
    onClose,
}: {
    trade: ShareableTrade | null;
    open: boolean;
    onClose: () => void;
}) {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleCopyToClipboard = useCallback(async () => {
        if (!trade) return;
        const t = trade;
        const isOpen = t.kind === 'open';
        const lines = [
            `📊 ${t.symbol} | ${t.type} | ${t.volume} lots`,
            `💰 P&L: ${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`,
            isOpen
                ? `📈 Entry: ${formatPrice((t as ShareableOpenTrade).priceOpen)} → Current: ${formatPrice((t as ShareableOpenTrade).priceCurrent)}`
                : `📈 Entry: ${formatPrice((t as ShareableClosedTrade).entryPrice)} → Exit: ${formatPrice((t as ShareableClosedTrade).exitPrice)}`,
            `⏱️ ${isOpen ? `Opened ${formatTime((t as ShareableOpenTrade).openTime)}` : getDuration((t as ShareableClosedTrade).entryTime, (t as ShareableClosedTrade).exitTime)}`,
            `🔖 ${isOpen ? 'OPEN' : 'CLOSED'} • ${t.accountName || 'MT5 Live'}`,
        ];
        await navigator.clipboard.writeText(lines.join('\n'));
        alert('Trade details copied to clipboard!');
    }, [trade]);

    const handleDownloadImage = useCallback(async () => {
        if (!cardRef.current) return;
        try {
            const dataUrl = await toPng(cardRef.current, {
                quality: 1,
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: '#0f0f23',
            });
            const link = document.createElement('a');
            link.download = `trade-${trade?.symbol || 'card'}-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            // Fallback: copy text if image capture fails
            handleCopyToClipboard();
        }
    }, [trade, handleCopyToClipboard]);

    if (!trade) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-4 w-4" /> Share Trade
                    </DialogTitle>
                    <DialogDescription>
                        Share or download your trade card.
                    </DialogDescription>
                </DialogHeader>
                <div className="p-5 space-y-4">
                    <div ref={cardRef}>
                        <TradeCardContent trade={trade} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyToClipboard}>
                            <Copy className="h-4 w-4" /> Copy Text
                        </Button>
                        <Button className="flex-1 gap-2" onClick={handleDownloadImage}>
                            <Download className="h-4 w-4" /> Download Image
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
