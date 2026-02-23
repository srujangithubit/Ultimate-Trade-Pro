'use client';

import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatPercent, getPnLColor } from '@/lib/utils/formatters';

interface AccountSummaryProps {
    balance: number;
    startingBalance: number;
    pnl: number;
}

export default function AccountSummary({ balance, startingBalance, pnl }: AccountSummaryProps) {
    const pnlPercent = ((balance - startingBalance) / startingBalance) * 100;
    const isProfit = pnl >= 0;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="text-sm font-bold font-mono">{formatCurrency(balance)}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isProfit ? 'bg-profit' : 'bg-loss'}`}>
                        {isProfit ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">P&L</p>
                        <p className={`text-sm font-bold font-mono ${getPnLColor(pnl)}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div>
                        <p className="text-xs text-muted-foreground">Return</p>
                        <p className={`text-sm font-bold ${getPnLColor(pnlPercent)}`}>
                            {formatPercent(pnlPercent)}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Progress</p>
                        <p className="text-xs font-mono text-muted-foreground">62%</p>
                    </div>
                    <Progress value={62} className="h-2" />
                </CardContent>
            </Card>
        </div>
    );
}
