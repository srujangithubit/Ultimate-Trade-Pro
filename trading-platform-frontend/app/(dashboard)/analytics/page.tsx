'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    TrendingUp,
    Target,
    Activity,
    Zap,
    BarChart3,
    Download,
    Calendar,
    BookOpen,
    MonitorSmartphone,
    ChevronDown,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/formatters';
import DetailedPerformanceCalendar from '@/components/charts/DetailedPerformanceCalendar';
import DetailedStatsGrid from '@/components/analytics/DetailedStatsGrid';
import AdvancedStatsGrid from '@/components/analytics/AdvancedStatsGrid';
import LongShortAnalysis from '@/components/analytics/LongShortAnalysis';
import TradeDistributionChart from '@/components/charts/TradeDistributionChart';
import WeekdayAnalysis from '@/components/analytics/WeekdayAnalysis';
import GrossDailyPnLChart from '@/components/analytics/GrossDailyPnLChart';
import DailyCumulativePnLChart from '@/components/analytics/DailyCumulativePnLChart';
import HourlyAnalytics from '@/components/analytics/HourlyAnalytics';
import WeeklyAnalytics from '@/components/analytics/WeeklyAnalytics';
import MonthlyAnalytics from '@/components/analytics/MonthlyAnalytics';
import DurationAnalytics from '@/components/analytics/DurationAnalytics';
import SymbolAnalytics from '@/components/analytics/SymbolAnalytics';
import SummaryWeek from '@/components/analytics/SummaryWeek';
import SummaryPairs from '@/components/analytics/SummaryPairs';
import SummarySession from '@/components/analytics/SummarySession';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { exportAnalyticsToCSV } from '@/lib/utils/exportAnalytics';
import { useMT5Accounts, type SavedMT5Account } from '@/lib/hooks/useMT5Accounts';
import { useMT5 } from '@/components/mt5/MT5Context';
import { buildMT5AnalyticsData } from '@/lib/utils/mt5StatsAdapter';

export default function AnalyticsPage() {
    const [dataSource, setDataSource] = useState<'journal' | 'accounts'>('journal');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null);

    // MT5 accounts & connection
    const { accounts } = useMT5Accounts();
    const mt5 = useMT5();

    // Handle account selection from dropdown
    const handleAccountSelect = async (accountId: string) => {
        setSelectedAccountId(accountId);
        const acc = accounts.find((a) => a.id === accountId);
        if (!acc) return;

        // If already connected to this account, refresh its data
        if (mt5.status.authenticated && mt5.account?.login === acc.login) {
            mt5.refreshTradeHistory(30);
            mt5.refreshPositions();
            mt5.refreshAccount();
            return;
        }

        // Otherwise, we need to connect — but we can't store passwords.
        // The MT5 context will show the currently connected account's data.
        // If user is already connected to a different account, show that data.
        // If not connected at all, prompt them to connect from the Accounts page.
    };

    const { data: overview, isLoading: isOverviewLoading } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: async () => {
            const { data } = await api.get('/analytics/overview');
            return data;
        },
        staleTime: 30_000,
    });

    const { data: equityCurve, isLoading: isEquityLoading } = useQuery({
        queryKey: ['analytics-equity'],
        queryFn: async () => {
            const { data } = await api.get('/analytics/equity');
            return data.map((d: any) => ({
                date: new Date(d.date).toLocaleDateString(),
                equity: Number(d.equity),
            }));
        },
        staleTime: 30_000,
    });

    // Fallback to defaults if loading or no data
    const stats = useMemo(() => ({
        totalPnl: overview?.totalPnl || 0,
        winRate: overview?.winRate || 0,
        profitFactor: overview?.profitFactor || 0,
        averageRR: overview?.averageRR || 0,
        expectancy: overview?.expectancy || 0,
        winningTrades: overview?.winningTrades || 0,
        losingTrades: overview?.losingTrades || 0,
        winRateBySetup: overview?.winRateBySetup || [],
        dailyPnl: overview?.dailyPnl || [],
        hourlyPnl: overview?.hourlyPnl || [],
        averageWin: overview?.averageWin || 0,
        averageLoss: overview?.averageLoss || 0,
        avgDailyPnl: overview?.avgDailyPnl || 0,
        largestWin: overview?.largestWin || 0,
        largestLoss: overview?.largestLoss || 0,
        totalTrades: overview?.totalTrades || 0,
        avgWinningDay: overview?.avgWinningDay || 0,
        avgLosingDay: overview?.avgLosingDay || 0,
        maxConsecutiveWins: overview?.maxConsecutiveWins || 0,
        maxConsecutiveLosses: overview?.maxConsecutiveLosses || 0,
        largestProfitableDay: overview?.largestProfitableDay || 0,
        largestLosingDay: overview?.largestLosingDay || 0,
        maxConsecutiveWinningDays: overview?.maxConsecutiveWinningDays || 0,
        maxConsecutiveLosingDays: overview?.maxConsecutiveLosingDays || 0,
        openTrades: overview?.openTrades || 0,
        totalDays: overview?.totalDays || 0,
        totalFees: overview?.totalFees || 0,
        totalCommission: overview?.totalCommission || 0,
        totalSwap: overview?.totalSwap || 0,
        tradeDistribution: overview?.tradeDistribution || [],
        weeklyDistribution: overview?.weeklyDistribution || [],
        monthlyDistribution: overview?.monthlyDistribution || [],
        durationDistribution: overview?.durationDistribution || [],
        symbolPerformance: overview?.symbolPerformance || [],
        sessionPerformance: overview?.sessionPerformance || [],
        bestWeek: overview?.bestWeek || 0,
        worstWeek: overview?.worstWeek || 0,
        bestMonth: overview?.bestMonth || 0,
        worstMonth: overview?.worstMonth || 0,
        avgWinStreak: overview?.avgWinStreak || 0,
        avgLossStreak: overview?.avgLossStreak || 0,
        maxWinStreak: overview?.maxWinStreak || 0,
        maxLossStreak: overview?.maxLossStreak || 0,
    }), [overview]);

    const breakdown = useMemo(() => overview?.breakdown || {
        all: {},
        long: {},
        short: {}
    }, [overview]);

    if (isOverviewLoading || isEquityLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>;
    }

    return (
        <div className="mx-auto w-full max-w-370 space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold leading-tight tracking-[-0.01em] md:text-4xl">Analytics</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground md:text-[15px]">
                        Deep dive into your trading performance and patterns.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/70 bg-card/70 p-2.5 shadow-[0_8px_22px_rgba(5,16,34,0.28)]">
                    {/* Data Source Tabs */}
                    <div className="flex items-center rounded-xl border border-border/70 bg-muted/40 p-1">
                        <button
                            onClick={() => setDataSource('journal')}
                            className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                                dataSource === 'journal'
                                    ? 'bg-background text-foreground shadow-[0_4px_10px_rgba(5,16,34,0.35)]'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <BookOpen className="h-3.5 w-3.5" />
                            Journal
                        </button>
                        <button
                            onClick={() => setDataSource('accounts')}
                            className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                                dataSource === 'accounts'
                                    ? 'bg-background text-foreground shadow-[0_4px_10px_rgba(5,16,34,0.35)]'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <MonitorSmartphone className="h-3.5 w-3.5" />
                            Accounts
                        </button>
                    </div>

                    {/* Account Dropdown — visible only in accounts mode */}
                    {dataSource === 'accounts' && (
                        <Select value={selectedAccountId} onValueChange={handleAccountSelect}>
                            <SelectTrigger className="h-9 w-56 gap-2 rounded-lg border-border/70 bg-background/95">
                                <MonitorSmartphone className="h-4 w-4 shrink-0" />
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.length === 0 ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                        No accounts saved.<br />
                                        Add accounts from the Accounts page.
                                    </div>
                                ) : (
                                    accounts.map((acc) => {
                                        const isConnected = mt5.status.authenticated && mt5.account?.login === acc.login;
                                        return (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex items-center gap-2">
                                                    {isConnected ? (
                                                        <Wifi className="h-3 w-3 text-emerald-500 shrink-0" />
                                                    ) : (
                                                        <WifiOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                                    )}
                                                    <span className="truncate">{acc.label}</span>
                                                    <span className="text-xs text-muted-foreground">#{acc.login}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })
                                )}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Time range & Export — visible only in journal mode */}
                    {dataSource === 'journal' && (
                        <>
                            <Tabs defaultValue="90d">
                                <TabsList className="h-9 rounded-lg border border-border/70 bg-muted/30 p-1">
                                    <TabsTrigger value="30d">30D</TabsTrigger>
                                    <TabsTrigger value="90d">90D</TabsTrigger>
                                    <TabsTrigger value="1y">1Y</TabsTrigger>
                                    <TabsTrigger value="all">All</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Button
                                variant="outline"
                                className="h-9 gap-2 rounded-lg"
                                onClick={() => exportAnalyticsToCSV(stats, breakdown, equityCurve || [])}
                            >
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ────── Accounts Mode ────── */}
            {dataSource === 'accounts' && (
                <AccountsAnalyticsContent
                    accounts={accounts}
                    selectedAccountId={selectedAccountId}
                    mt5={mt5}
                />
            )}

            {/* ────── Journal Mode ────── */}
            {dataSource === 'journal' && (
                <>
            {/* Detailed Stats Grid */}
            <div className="animate-fadeIn">
                <DetailedStatsGrid stats={stats} />
            </div>

            {/* Advanced Stats & Equity Grid */}
            <div className="animate-fadeIn" style={{ animationDelay: '100ms' }}>
                <AdvancedStatsGrid data={{ equityCurve: equityCurve || [], stats: stats }} />
            </div>

            {/* Long/Short Analysis */}
            <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                <LongShortAnalysis data={breakdown} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2 animate-fadeIn" style={{ animationDelay: '250ms' }}>
                {/* Win Rate by Setup */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Win Rate by Setup</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-75" style={{ minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                    <BarChart data={stats.winRateBySetup} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} />
                                        <YAxis
                                            type="category"
                                            dataKey="setup"
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            width={100}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(23, 23, 46, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                color: '#e5e7eb',
                                            }}
                                        />
                                        <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                                            {stats.winRateBySetup.map((entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.winRate >= 55 ? '#22c55e' : entry.winRate >= 45 ? '#f59e0b' : '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Wins vs Losses pie (Calculated from real stats) */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Win / Loss Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-75 flex items-center justify-center" style={{ minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Wins', value: stats.winningTrades || 0 },
                                                { name: 'Losses', value: stats.losingTrades || 0 },
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={(({ cx, cy, midAngle, innerRadius, outerRadius, value }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; value: number }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
                                                const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
                                                return (
                                                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
                                                        {value}
                                                    </text>
                                                );
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            }) as any}
                                            labelLine={false}
                                        >
                                            <Cell fill="#22c55e" />
                                            <Cell fill="#ef4444" />
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(23, 23, 46, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                color: '#e5e7eb',
                                            }}
                                        />
                                        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize={22} fontWeight={700}>
                                            {(stats.winningTrades || 0) + (stats.losingTrades || 0)}
                                        </text>
                                        <text x="50%" y="57%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" fontSize={12}>
                                            Total Trades
                                        </text>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-green-500" />
                                    <span className="text-sm font-medium text-foreground">Wins: {stats.winningTrades || 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-red-500" />
                                    <span className="text-sm font-medium text-foreground">Losses: {stats.losingTrades || 0}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Trade Distribution and Hourly Performance */}
            <div>
                <HourlyAnalytics data={stats.hourlyPnl} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <TradeDistributionChart data={stats.tradeDistribution} />
                </div>
                <div className="lg:col-span-2">
                    <WeekdayAnalysis data={stats?.tradeDistribution || []} />
                </div>
            </div>

            {/* Bottom charts */}
            <div className="space-y-6">
                {/* Summary Week Table */}
                <SummaryWeek data={stats.tradeDistribution} />

                {/* Summary Pairs Table */}
                <SummaryPairs data={stats.symbolPerformance} />

                {/* Summary Session Table */}
                <SummarySession data={stats.sessionPerformance} />

                {/* Weekly Analytics */}
                <WeeklyAnalytics data={stats.weeklyDistribution} />

                {/* Monthly Analytics */}
                <MonthlyAnalytics data={stats.monthlyDistribution} />

                {/* Duration Analytics */}
                <DurationAnalytics data={stats.durationDistribution} />

                {/* Symbol Analytics */}
                <SymbolAnalytics data={stats.symbolPerformance} />

                {/* Daily Performance Calendar */}
                <Card className="w-full">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">Daily Performance</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DetailedPerformanceCalendar data={stats.dailyPnl} />
                    </CardContent>
                </Card>

                {/* Gross Daily P&L Chart */}
                <GrossDailyPnLChart data={stats?.dailyPnl || []} />

                {/* Daily Cumulative P&L (Detailed Request) */}
                <DailyCumulativePnLChart dailyData={stats.dailyPnl} stats={stats} />
            </div>
                </>
            )}
        </div >
    );
}

/* ------------------------------------------------------------------ */
/*  Accounts Analytics — shown when "Accounts" tab is active           */
/* ------------------------------------------------------------------ */

interface AccountsAnalyticsContentProps {
    accounts: SavedMT5Account[];
    selectedAccountId: string;
    mt5: ReturnType<typeof useMT5>;
}

function AccountsAnalyticsContent({ accounts, selectedAccountId, mt5 }: AccountsAnalyticsContentProps) {
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    const isConnectedToSelected = selectedAccount && mt5.status.authenticated && mt5.account?.login === selectedAccount.login;

    // Fetch trade history & positions when the connected account is selected
    useEffect(() => {
        if (isConnectedToSelected) {
            mt5.refreshTradeHistory(30);
            mt5.refreshPositions();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnectedToSelected]);

    // Compute full analytics from MT5 data (same shape as Journal stats)
    const { stats: mt5Stats, breakdown: mt5Breakdown, equityCurve: mt5Equity } = useMemo(
        () => buildMT5AnalyticsData(mt5.positions, mt5.tradeHistory),
        [mt5.positions, mt5.tradeHistory],
    );

    // No account selected yet
    if (!selectedAccountId || !selectedAccount) {
        return (
            <div className="animate-fadeIn">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <MonitorSmartphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Select a Trading Account</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Choose a live trading account from the dropdown above to view analytics
                            for its open positions and closed trade history.
                        </p>
                        {accounts.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-4">
                                No accounts saved yet. Go to the{' '}
                                <a href="/accounts" className="text-primary underline underline-offset-4">
                                    Accounts page
                                </a>{' '}
                                to add your MT5 accounts.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Account selected but not connected
    if (!isConnectedToSelected) {
        return (
            <div className="animate-fadeIn">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <WifiOff className="h-12 w-12 text-amber-500/60 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Account Not Connected</h3>
                        <p className="text-sm text-muted-foreground max-w-md mb-1">
                            <span className="font-medium text-foreground">{selectedAccount.label}</span>{' '}
                            (#{selectedAccount.login}) is not currently connected.
                        </p>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Please connect to this account from the{' '}
                            <a href="/accounts" className="text-primary underline underline-offset-4">
                                Accounts page
                            </a>{' '}
                            to view its analytics.
                        </p>
                        {mt5.status.authenticated && mt5.account && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                                <Wifi className="h-3 w-3 text-emerald-500" />
                                Currently connected to: <span className="font-medium text-foreground">{mt5.account.name} #{mt5.account.login}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Account is connected — show full analytics identical to Journal tab
    return (
        <div className="space-y-8">
            {/* Connection status badge */}
            <div className="animate-fadeIn">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                        <Wifi className="h-3 w-3" />
                        Connected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                        {selectedAccount.label} — #{selectedAccount.login} · {mt5.account?.server}
                    </span>
                    {mt5.account && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                            Balance: {formatCurrency(mt5.account.balance)} · Equity: {formatCurrency(mt5.account.equity)}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Detailed Stats Grid */}
            <div className="animate-fadeIn" style={{ animationDelay: '100ms' }}>
                <DetailedStatsGrid stats={mt5Stats} />
            </div>

            {/* Advanced Stats & Equity Grid */}
            <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                <AdvancedStatsGrid data={{ equityCurve: mt5Equity, stats: mt5Stats }} />
            </div>

            {/* Long/Short Analysis */}
            <div className="animate-fadeIn" style={{ animationDelay: '250ms' }}>
                <LongShortAnalysis data={mt5Breakdown} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                {/* Win Rate by Symbol */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Win Rate by Symbol</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-75">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mt5Stats.winRateBySetup} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} />
                                        <YAxis
                                            type="category"
                                            dataKey="setup"
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            width={100}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(23, 23, 46, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                color: '#e5e7eb',
                                            }}
                                        />
                                        <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                                            {mt5Stats.winRateBySetup.map((entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.winRate >= 55 ? '#22c55e' : entry.winRate >= 45 ? '#f59e0b' : '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Wins vs Losses pie */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Win / Loss Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-75 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Wins', value: mt5Stats.winningTrades || 0 },
                                                { name: 'Losses', value: mt5Stats.losingTrades || 0 },
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={(({ cx, cy, midAngle, innerRadius, outerRadius, value }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; value: number }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
                                                const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
                                                return (
                                                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
                                                        {value}
                                                    </text>
                                                );
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            }) as any}
                                            labelLine={false}
                                        >
                                            <Cell fill="#22c55e" />
                                            <Cell fill="#ef4444" />
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(23, 23, 46, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                color: '#e5e7eb',
                                            }}
                                        />
                                        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize={22} fontWeight={700}>
                                            {(mt5Stats.winningTrades || 0) + (mt5Stats.losingTrades || 0)}
                                        </text>
                                        <text x="50%" y="57%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" fontSize={12}>
                                            Total Trades
                                        </text>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-green-500" />
                                    <span className="text-sm font-medium text-foreground">Wins: {mt5Stats.winningTrades || 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-red-500" />
                                    <span className="text-sm font-medium text-foreground">Losses: {mt5Stats.losingTrades || 0}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Hourly Performance */}
            <div>
                <HourlyAnalytics data={mt5Stats.hourlyPnl} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <TradeDistributionChart data={mt5Stats.tradeDistribution} />
                </div>
                <div className="lg:col-span-2">
                    <WeekdayAnalysis data={mt5Stats.tradeDistribution} />
                </div>
            </div>

            {/* Bottom charts */}
            <div className="space-y-6">
                <SummaryWeek data={mt5Stats.tradeDistribution} />
                <SummaryPairs data={mt5Stats.symbolPerformance} />
                <SummarySession data={mt5Stats.sessionPerformance} />
                <WeeklyAnalytics data={mt5Stats.weeklyDistribution} />
                <MonthlyAnalytics data={mt5Stats.monthlyDistribution} />
                <DurationAnalytics data={mt5Stats.durationDistribution} />
                <SymbolAnalytics data={mt5Stats.symbolPerformance} />

                {/* Daily Performance Calendar */}
                <Card className="w-full">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">Daily Performance</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DetailedPerformanceCalendar data={mt5Stats.dailyPnl} />
                    </CardContent>
                </Card>

                <GrossDailyPnLChart data={mt5Stats.dailyPnl} />
                <DailyCumulativePnLChart dailyData={mt5Stats.dailyPnl} stats={mt5Stats} />
            </div>
        </div>
    );
}

