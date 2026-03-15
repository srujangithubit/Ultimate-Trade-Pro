'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { motion } from 'framer-motion';

interface SessionStats {
    session: string;
    netProfit: number;
    totalProfit: number;
    totalLoss: number;
    wins: number;
    losses: number;
    totalTrades: number;
    winRate: number;
}

interface SummarySessionProps {
    data: SessionStats[];
}

function UKFlag() {
    return (
        <svg width="20" height="20" viewBox="0 0 60 60" className="rounded-full shrink-0">
            <clipPath id="uk-clip"><circle cx="30" cy="30" r="30" /></clipPath>
            <g clipPath="url(#uk-clip)">
                <rect width="60" height="60" fill="#012169" />
                <path d="M0,0 L60,60 M60,0 L0,60" stroke="#fff" strokeWidth="10" />
                <path d="M0,0 L60,60 M60,0 L0,60" stroke="#C8102E" strokeWidth="6" />
                <path d="M30,0 V60 M0,30 H60" stroke="#fff" strokeWidth="14" />
                <path d="M30,0 V60 M0,30 H60" stroke="#C8102E" strokeWidth="8" />
            </g>
        </svg>
    );
}

function USFlag() {
    return (
        <svg width="20" height="20" viewBox="0 0 60 60" className="rounded-full shrink-0">
            <clipPath id="us-clip"><circle cx="30" cy="30" r="30" /></clipPath>
            <g clipPath="url(#us-clip)">
                <rect width="60" height="60" fill="#B22234" />
                <path d="M0,5H60 M0,14H60 M0,23H60 M0,32H60 M0,41H60 M0,50H60" stroke="#fff" strokeWidth="4.5" />
                <rect width="28" height="28" fill="#3C3B6E" />
                <g fill="#fff">
                    <circle cx="7" cy="5" r="1.5" /><circle cx="14" cy="5" r="1.5" /><circle cx="21" cy="5" r="1.5" />
                    <circle cx="10.5" cy="10" r="1.5" /><circle cx="17.5" cy="10" r="1.5" />
                    <circle cx="7" cy="15" r="1.5" /><circle cx="14" cy="15" r="1.5" /><circle cx="21" cy="15" r="1.5" />
                    <circle cx="10.5" cy="20" r="1.5" /><circle cx="17.5" cy="20" r="1.5" />
                    <circle cx="7" cy="25" r="1.5" /><circle cx="14" cy="25" r="1.5" /><circle cx="21" cy="25" r="1.5" />
                </g>
            </g>
        </svg>
    );
}

function JPFlag() {
    return (
        <svg width="20" height="20" viewBox="0 0 60 60" className="rounded-full shrink-0">
            <clipPath id="jp-clip"><circle cx="30" cy="30" r="30" /></clipPath>
            <g clipPath="url(#jp-clip)">
                <rect width="60" height="60" fill="#fff" />
                <circle cx="30" cy="30" r="12" fill="#BC002D" />
            </g>
        </svg>
    );
}

function GlobeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8" />
            <ellipse cx="10" cy="10" rx="4" ry="8" />
            <path d="M2,10 H18" />
            <path d="M3.5,5 H16.5" />
            <path d="M3.5,15 H16.5" />
        </svg>
    );
}

const sessionIcons: Record<string, React.FC> = {
    London: UKFlag,
    NY: USFlag,
    Asian: JPFlag,
    'Outside of Sessions': GlobeIcon,
};

function WinRateBar({ winRate, totalTrades }: { winRate: number; totalTrades: number }) {
    if (totalTrades === 0) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex h-2.5 w-24 overflow-hidden rounded-full bg-muted/30">
                    <div className="w-full bg-muted/50" />
                </div>
            </div>
        );
    }
    const lossRate = 100 - winRate;
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-2.5 w-24 overflow-hidden rounded-full">
                <motion.div
                    className="bg-emerald-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${winRate}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <motion.div
                    className="bg-red-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${lossRate}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

function SummarySession({ data }: SummarySessionProps) {
    if (!data || data.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Summary Session</CardTitle>
                    <Info className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border/50 hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider pl-6">
                                Session
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Net Profit
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Win Rate
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Profit
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Loss
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Win Rate
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Trades
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((session) => (
                            <TableRow
                                key={session.session}
                                className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                            >
                                <TableCell className="pl-6">
                                    <div className="flex items-center gap-2.5">
                                        {(() => {
                                            const IconComponent = sessionIcons[session.session] || GlobeIcon;
                                            return <IconComponent />;
                                        })()}
                                        <span className="font-medium text-sm text-muted-foreground">
                                            {session.session}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell
                                    className={`font-mono font-semibold text-sm ${session.netProfit > 0
                                        ? 'text-emerald-500'
                                        : session.netProfit < 0
                                            ? 'text-red-500'
                                            : 'text-muted-foreground'
                                        }`}
                                >
                                    {formatCurrency(session.netProfit)}
                                </TableCell>
                                <TableCell>
                                    <WinRateBar winRate={session.winRate} totalTrades={session.totalTrades} />
                                </TableCell>
                                <TableCell className="font-mono text-sm text-emerald-500">
                                    {formatCurrency(session.totalProfit)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-red-500">
                                    {formatCurrency(session.totalLoss)}
                                </TableCell>
                                <TableCell
                                    className={`font-mono text-sm ${session.winRate > 50
                                        ? 'text-emerald-500'
                                        : session.totalTrades === 0
                                            ? 'text-muted-foreground'
                                            : 'text-red-500'
                                        }`}
                                >
                                    {session.winRate.toFixed(2)}%
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                    {session.totalTrades}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default memo(SummarySession);
