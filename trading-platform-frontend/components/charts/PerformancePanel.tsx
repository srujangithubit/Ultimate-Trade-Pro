'use client';

import {
    ComposedChart,
    Area,
    Bar,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { usePerformance } from '@/lib/hooks/usePerformance';
import type { EquityCurvePoint } from '@/lib/types/trading';

export default function PerformancePanel() {
    const { stats, equityCurve, isLoading } = usePerformance();

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border border-indigo-500/30 border-t-indigo-500" />
                    <span className="text-[10px] text-muted-foreground font-mono">Loading metrics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-3 space-y-3">
            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-3 gap-2">
                    <StatCard
                        label="Net P&L"
                        value={`${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl.toLocaleString()}`}
                        color={stats.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    />
                    <StatCard
                        label="Win Rate"
                        value={`${stats.winRate.toFixed(1)}%`}
                        color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}
                        bar={stats.winRate}
                    />
                    <StatCard
                        label="Max Drawdown"
                        value={`$${stats.maxDrawdown.toLocaleString()}`}
                        color="text-red-400"
                    />
                    <StatCard
                        label="Sharpe Ratio"
                        value={stats.sharpeRatio.toFixed(2)}
                        color={stats.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-muted-foreground'}
                    />
                    <StatCard
                        label="Profit Factor"
                        value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                        color={stats.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}
                    />
                    <StatCard
                        label="Expectancy"
                        value={`${stats.expectancy >= 0 ? '+' : ''}$${stats.expectancy.toFixed(2)}`}
                        color={stats.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    />
                </div>
            )}

            {/* Equity Curve Chart */}
            {equityCurve.length > 0 && (
                <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <defs>
                                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                                tickLine={false}
                                tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="equity"
                                stroke="#00d4aa"
                                strokeWidth={1.5}
                                fill="url(#equityGradient)"
                            />
                            <Bar
                                dataKey="drawdown"
                                fill="#ff4444"
                                opacity={0.4}
                                barSize={4}
                            />
                            <Line
                                type="monotone"
                                dataKey="benchmark"
                                stroke="#555"
                                strokeDasharray="4 2"
                                strokeWidth={1}
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {equityCurve.length === 0 && !isLoading && (
                <div className="h-[180px] flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                    No trade data for equity curve
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, color, bar }: { label: string; value: string; color: string; bar?: number }) {
    return (
        <div className="bg-accent/30 border border-border rounded-lg p-2">
            <div className="text-[9px] font-mono text-muted-foreground mb-1">{label}</div>
            <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
            {bar !== undefined && (
                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500/50 rounded-full transition-all"
                        style={{ width: `${Math.min(bar, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) {
    if (!active || !payload) return null;

    return (
        <div className="bg-muted border border-border rounded p-2 shadow-xl">
            <div className="text-[9px] font-mono text-muted-foreground mb-1">{label}</div>
            {payload.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className={
                        entry.name === 'equity' ? 'text-emerald-400' :
                            entry.name === 'drawdown' ? 'text-red-400' :
                                'text-muted-foreground'
                    }>
                        {entry.name}:
                    </span>
                    <span className="text-foreground/80">${entry.value.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}
