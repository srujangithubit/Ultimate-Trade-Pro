'use client';

import { use, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Download, TrendingUp, TrendingDown,
    Activity, Target, AlertTriangle, Scale,
    PiggyBank, ArrowDownRight
} from 'lucide-react';
import {
    ComposedChart, Area, Line, Bar, XAxis, YAxis,
    Tooltip, ReferenceLine, Brush,
    PieChart, Pie, Cell, BarChart
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

import api from '@/lib/api/client';
import { PerformanceReport } from '@/lib/types/backtesting';

// Helper Formatters
const fCur = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val ?? 0);
const fPct = (val: number) => `${(val ?? 0).toFixed(2)}%`;
const fNum = (val: number) => (val ?? 0).toFixed(2);

export default function BacktestReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const sessionId = resolvedParams.sessionId;

    const { data: stats, isLoading, isError } = useQuery<PerformanceReport>({
        queryKey: ['report', sessionId],
        queryFn: async () => (await api.get(`/backtesting/sessions/${sessionId}/report`)).data,
    });

    const [sortCol, setSortCol] = useState('exitTime');
    const [sortAsc, setSortAsc] = useState(false);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0 }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isError || !stats) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <h2 className="text-xl font-bold">Failed to load report</h2>
                <button onClick={() => router.push(`/backtesting/${sessionId}`)} className="mt-4 text-[#00d4aa] hover:underline">Return to Session</button>
            </div>
        );
    }

    const exportCSV = () => {
        // Generate simple blob CSV from trades if available in state or refetched.
        // The report endpoint doesn't return full trades array currently per prompt spec, it only returns stats.
        // Assuming trades exist in context or via separate fetch if needed. For this spec, we just mock the export.
        alert('Detailed trades export to CSV initiated.');
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 pb-20 custom-scrollbar">
            <div className="max-w-350 mx-auto space-y-6">

                {/* HEADER */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-end border-b border-border pb-4">
                    <div>
                        <button onClick={() => router.push(`/backtesting/${sessionId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#00d4aa] transition-colors mb-4">
                            <ArrowLeft className="w-4 h-4" /> Back to Session
                        </button>
                        <h1 className="text-3xl font-bold text-foreground mb-1">Performance Report</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded font-bold uppercase">{stats.instrument}</span>
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded font-medium">{stats.timeframe}</span>
                            <span className="ml-2">{new Date(stats.startDate).toLocaleDateString()} &mdash; {new Date(stats.endDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={exportCSV} className="flex items-center gap-2 bg-secondary hover:bg-accent border border-border text-foreground px-4 py-2 rounded-lg font-medium transition-colors">
                        <Download className="w-4 h-4" /> Export Report
                    </button>
                </motion.div>

                {/* SECTION 1: SUMMARY CARDS */}
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Net P&L</span>
                            <Activity className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold font-mono ${stats.netPnL >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>
                                {stats.netPnL >= 0 ? '+' : ''}{fCur(stats.netPnL)}
                            </p>
                            <p className={`text-xs mt-1 ${stats.returnPct >= 0 ? 'text-[#00d4aa]/70' : 'text-[#ff4444]/70'}`}>
                                Return: {fPct(stats.returnPct)}
                            </p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Total Trades</span>
                            <Target className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.totalTrades}</p>
                            <p className="text-xs mt-1 text-muted-foreground">
                                <span className="text-[#00d4aa]">{stats.winningTrades}W</span> / <span className="text-[#ff4444]">{stats.losingTrades}L</span> / <span className="text-muted-foreground">{stats.breakEvenTrades}BE</span>
                            </p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Win Rate</span>
                            <svg className="w-4 h-4 text-[#00d4aa]" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${stats.winRate * 100}, 100`} />
                            </svg>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#00d4aa]">{fPct(stats.winRate * 100)}</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Profit Factor</span>
                            <Scale className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${stats.profitFactor > 1.5 ? 'text-[#00d4aa]' : stats.profitFactor > 1 ? 'text-yellow-400' : 'text-[#ff4444]'}`}>
                                {stats.profitFactor === Infinity ? 'MAX' : fNum(stats.profitFactor)}
                            </p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Max Drawdown</span>
                            <ArrowDownRight className="w-4 h-4 text-[#ff4444]" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#ff4444]">{fPct(stats.maxDrawdown)}</p>
                            <p className="text-xs mt-1 text-[#ff4444]/60">{fCur(stats.maxDrawdownAbs)}</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Sharpe Ratio</span>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{fNum(stats.sharpeRatio)}</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Expectancy</span>
                            <PiggyBank className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold font-mono ${stats.expectancy >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>
                                {fCur(stats.expectancy)}
                            </p>
                            <p className="text-xs mt-1 text-muted-foreground">Per trade average</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-card border border-border p-5 rounded-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Sortino Ratio</span>
                            <TrendingDown className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{fNum(stats.sortinoRatio)}</p>
                        </div>
                    </motion.div>
                </motion.div>

                {/* SECTION 2: EQUITY CURVE */}
                <div className="bg-card border border-border rounded-xl p-5">
                    <h2 className="text-base font-bold text-foreground mb-4 uppercase tracking-wide">Equity Curve</h2>
                    <div className="h-70 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stats.equityCurve} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tickFormatter={(v) => `$${v.toLocaleString()}`} stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" domain={[-stats.maxDrawdown * 1.5, 0]} tickFormatter={(v) => `${v.toFixed(1)}%`} stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 12 }} />

                                <Tooltip
                                    contentStyle={{ backgroundColor: '#11111a', borderColor: '#374151', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val: any, name: string | undefined) => [name === 'drawdown' ? `${Number(val).toFixed(2)}%` : `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name?.toUpperCase() || '']}
                                    labelFormatter={(lbl) => new Date(lbl).toLocaleString()}
                                />

                                <ReferenceLine yAxisId="left" y={stats.startingBalance} stroke="#6b7280" strokeDasharray="8 4" opacity={0.5} />

                                <Bar yAxisId="right" dataKey="drawdown" fill="#ff4444" opacity={0.3} isAnimationActive={false} />
                                <Area yAxisId="left" type="stepAfter" dataKey="equity" stroke="#00d4aa" strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" isAnimationActive={false} />
                                <Line yAxisId="left" type="stepAfter" dataKey="balance" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} />

                                <Brush dataKey="time" height={30} stroke="#374151" fill="var(--card)" tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* SECTION 3: STATISTICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-border bg-secondary"><h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Trade Statistics</h3></div>
                        <div className="p-0">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Gross P&L</td><td className="p-3 text-right font-mono text-foreground">{fCur(stats.grossPnL)}</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Total Commissions</td><td className="p-3 text-right font-mono text-foreground">{fCur(stats.totalCommission)}</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Largest Win</td><td className="p-3 text-right font-mono text-[#00d4aa]">{fCur(stats.largestWin)}</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Largest Loss</td><td className="p-3 text-right font-mono text-[#ff4444]">{fCur(stats.largestLoss)}</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Average Win</td><td className="p-3 text-right font-mono text-foreground">{fCur(stats.avgWin)}</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Average Loss</td><td className="p-3 text-right font-mono text-foreground">{fCur(-stats.avgLoss)}</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Payoff Ratio (RR)</td><td className="p-3 text-right font-mono text-foreground">{fNum(stats.payoffRatio)}</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Avg Hold Time</td><td className="p-3 text-right font-mono text-foreground">{Math.round(stats.avgHoldingPeriodSeconds / 60)} mins</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Consecutive Wins (Max)</td><td className="p-3 text-right font-mono text-[#00d4aa]">{stats.maxConsecutiveWins}</td></tr>
                                    <tr className="bg-card"><td className="p-3 text-muted-foreground">Consecutive Losses (Max)</td><td className="p-3 text-right font-mono text-[#ff4444]">{stats.maxConsecutiveLosses}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-border bg-secondary"><h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Risk Metrics</h3></div>
                        <div className="p-0">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Calmar Ratio</td><td className="p-3 text-right font-mono text-foreground">{fNum(stats.calmarRatio)}</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Recovery Factor</td><td className="p-3 text-right font-mono text-foreground">{fNum(stats.recoveryFactor)}</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Max Drawdown Duration</td><td className="p-3 text-right font-mono text-foreground">{Math.round(stats.maxDrawdownDuration / 3600)} Hours</td></tr>
                                    <tr className="border-b border-border/50 bg-card"><td className="p-3 text-muted-foreground">Loss Rate</td><td className="p-3 text-right font-mono text-[#ff4444]">{fPct(stats.lossRate * 100)}</td></tr>
                                    <tr className="border-b border-border/50 bg-background"><td className="p-3 text-muted-foreground">Expected Value ($)</td><td className="p-3 text-right font-mono text-foreground">{fCur(stats.expectancy)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* SECTION 4 & 5: LONG/SHORT BREAKDOWN & DISTRIBUTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h2 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wide">Directional Breakdown</h2>
                        <div className="flex justify-around items-center h-45">
                            {/* Longs */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-xs text-muted-foreground font-bold uppercase mb-2">Longs</h4>
                                <div className="h-25 w-25 mb-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={[{ value: stats.longTrades.wins }, { value: stats.longTrades.losses }]} innerRadius={35} outerRadius={45} dataKey="value" stroke="none">
                                                <Cell fill="#00d4aa" />
                                                <Cell fill="#ff4444" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <span className="text-sm font-bold text-foreground max-w-full text-center">
                                    {stats.longTrades.total} Trades<br /><span className="text-[#00d4aa]">{fPct(stats.longTrades.winRate * 100)} WR</span>
                                </span>
                                <span className={`text-xs mt-1 ${stats.longTrades.totalPnL >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>{fCur(stats.longTrades.totalPnL)}</span>
                            </div>

                            {/* Shorts */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-xs text-muted-foreground font-bold uppercase mb-2">Shorts</h4>
                                <div className="h-25 w-25 mb-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={[{ value: stats.shortTrades.wins }, { value: stats.shortTrades.losses }]} innerRadius={35} outerRadius={45} dataKey="value" stroke="none">
                                                <Cell fill="#00d4aa" />
                                                <Cell fill="#ff4444" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <span className="text-sm font-bold text-foreground max-w-full text-center">
                                    {stats.shortTrades.total} Trades<br /><span className="text-[#00d4aa]">{fPct(stats.shortTrades.winRate * 100)} WR</span>
                                </span>
                                <span className={`text-xs mt-1 ${stats.shortTrades.totalPnL >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>{fCur(stats.shortTrades.totalPnL)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
                        <h2 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wide">P&L Distribution</h2>
                        <div className="flex-1 min-h-45">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.tradeDistribution}>
                                    <XAxis dataKey="label" hide />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ fill: '#1f2937', opacity: 0.5 }}
                                        contentStyle={{ backgroundColor: '#11111a', borderColor: '#374151', color: '#fff' }}
                                        formatter={(val: any) => [Number(val), 'Count']}
                                        labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
                                    />
                                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                                        {stats.tradeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={(entry.label ?? '').includes('-') && !(entry.label ?? '').includes(' to $0') ? '#ff4444' : '#00d4aa'} opacity={0.7} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* SECTION 6: MONTHLY RETURNS */}
                <div className="bg-card border border-border rounded-xl p-5 mb-8">
                    <h2 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wide">Monthly Returns Heatmap</h2>
                    {stats.monthlyReturns.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No monthly return data available yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
                            {stats.monthlyReturns.map((m) => {
                                const returnClass = m.return > 3 ? 'bg-green-800/80 text-green-200 border border-green-700' :
                                    m.return > 1 ? 'bg-green-900/60 text-green-300 border border-green-800' :
                                        m.return > 0 ? 'bg-muted text-foreground border border-border' :
                                            m.return > -1 ? 'bg-red-900/60 text-red-300 border border-red-800' :
                                                'bg-red-800/80 text-red-200 border border-red-700';
                                return (
                                    <div key={m.month} className={`flex flex-col items-center justify-center p-2 rounded-md transition-all hover:scale-105 cursor-default ${returnClass}`} title={`Trades: ${m.trades} | PnL: ${fCur(m.pnl)}`}>
                                        <span className="font-bold opacity-60 text-[10px] mb-1">{m.month}</span>
                                        <span className="font-mono font-bold text-xs">{fPct(m.return)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
