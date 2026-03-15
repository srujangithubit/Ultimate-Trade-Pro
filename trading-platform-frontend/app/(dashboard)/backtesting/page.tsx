'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Play, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api/client';
import { BacktestSession, CreateSessionDto } from '@/lib/types/backtesting';

const INSTRUMENTS = ['ES', 'NQ', 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
];

const safeDate = (d: any) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? 'N/A' : dt.toISOString().split('T')[0];
};

/** Convert a datetime-local value ("YYYY-MM-DDTHH:mm") in the given IANA
 *  timezone to a UTC ISO-8601 string suitable for the backend. */
const toUTCISO = (dtLocal: string, timezone: string): string => {
    // Treat the string as UTC first so we can compute the tz offset
    const asUTC = new Date(dtLocal + ':00Z');
    if (isNaN(asUTC.getTime())) return new Date(dtLocal).toISOString();
    const utcStr = asUTC.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr  = asUTC.toLocaleString('en-US', { timeZone: timezone });
    const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
    return new Date(asUTC.getTime() - offsetMs).toISOString();
};

export default function BacktestingSessionsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const defaultEnd = new Date();

    const [form, setForm] = useState({
        sessionName: '',
        instrument: 'XAUUSD',
        assetClass: 'futures',
        timeframe: '1h',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        startDate: defaultStart.toISOString().slice(0, 16),
        endDate: defaultEnd.toISOString().slice(0, 16),
        startingBalance: 50000,
        commission: 2,
        slippage: 0.5,
        spread: 0.5,
    });

    const { data: sessions, isLoading } = useQuery<BacktestSession[]>({
        queryKey: ['backtest-sessions'],
        queryFn: async () => {
            const res = await api.get('/backtesting/sessions');
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (dto: CreateSessionDto) => {
            const res = await api.post('/backtesting/sessions', dto);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['backtest-sessions'] });
            setCreateDialogOpen(false);
            router.push(`/backtesting/${data.id}`);
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Failed to create session');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/backtesting/sessions/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backtest-sessions'] });
        },
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            sessionName: form.sessionName || `${form.instrument} ${form.timeframe} Backtest`,
            instrument: form.instrument,
            assetClass: form.assetClass,
            timeframe: form.timeframe as any,
            timezone: form.timezone,
            startDate: toUTCISO(form.startDate, form.timezone),
            endDate: toUTCISO(form.endDate, form.timezone),
            startingBalance: Number(form.startingBalance),
            config: {
                commission: Number(form.commission),
                slippage: Number(form.slippage),
                spread: Number(form.spread),
                initialBalance: Number(form.startingBalance),
            }
        });
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0 }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'created': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
            case 'running': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';
            case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="min-h-screen bg-background p-6 text-foreground">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Backtesting</h1>
                        <p className="text-sm text-muted-foreground">Replay historical data to test your trading strategies.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/backtesting/trade-analysis"
                            className="flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 font-semibold text-white transition-smooth hover:bg-sky-600 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.32),0_14px_34px_rgba(0,102,255,0.42)]"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Trade Analysis
                        </Link>
                        <button
                            onClick={() => setCreateDialogOpen(true)}
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 bg-[#00d4aa] text-[#0a0a0f] hover:bg-[#00e6b8] px-4 py-2 rounded-md font-semibold transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            New Session
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4aa]"></div>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {sessions?.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 py-24 border border-border border-dashed rounded-xl bg-card">
                                <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                                    <Play className="h-6 w-6" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-1">No sessions yet</h3>
                                <p className="text-sm text-muted-foreground">Create a new backtesting session to get started.</p>
                            </div>
                        ) : (
                            sessions?.map((s) => {
                                const returnPct = s.startingBalance ? ((s.currentBalance - s.startingBalance) / s.startingBalance) * 100 : 0;
                                const isPositive = returnPct >= 0;
                                const progressPct = s.totalCandles ? (s.replayIndex / s.totalCandles) * 100 : 0;

                                return (
                                    <motion.div
                                        key={s.id}
                                        variants={itemVariants}
                                        className="card-hover flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-smooth hover:border-primary/45 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.3),0_16px_34px_rgba(0,102,255,0.3)]"
                                    >
                                        <div className="p-5 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-2">
                                                    <span className="px-2 py-1 bg-muted rounded text-xs font-bold text-foreground">{s.instrument}</span>
                                                    <span className="px-2 py-1 bg-muted rounded text-xs font-medium text-muted-foreground">{s.timeframe}</span>
                                                    {s.timezone && <span className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">{s.timezone.replace(/_/g, ' ')}</span>}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold border ${getStatusColor(s.status)}`}>
                                                    {s.status}
                                                </span>
                                            </div>

                                            <div className="text-xs text-muted-foreground mb-6 flex flex-col gap-1">
                                                <div>From: <span className="text-foreground">{safeDate(s.startDate)}</span></div>
                                                <div>To: <span className="text-foreground">{safeDate(s.endDate)}</span></div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Starting Balance</p>
                                                    <p className="font-mono text-sm">${Number(s.startingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                                                    <p className="font-mono text-sm">${Number(s.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-xs text-muted-foreground mb-1">Net Return</p>
                                                    <p className={`font-mono font-bold ${isPositive ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>
                                                        {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-[#00d4aa] h-1.5 rounded-full" style={{ width: `${progressPct}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="bg-secondary p-3 border-t border-border flex items-center justify-between gap-2">
                                            <div className="flex gap-2 w-full">
                                                <Link
                                                    href={`/backtesting/${s.id}`}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded border border-border/70 bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-smooth hover:border-primary/45 hover:bg-accent hover:shadow-[0_0_0_2px_rgba(0,102,255,0.24),0_10px_24px_rgba(0,102,255,0.24)]"
                                                >
                                                    <Play className="w-3.5 h-3.5" />
                                                    {s.status === 'completed' ? 'View' : 'Open'}
                                                </Link>
                                                {s.status === 'completed' && (
                                                    <Link
                                                        href={`/backtesting/${s.id}/report`}
                                                        className="flex flex-1 items-center justify-center gap-1.5 rounded border border-indigo-500/30 bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-smooth hover:border-primary/50 hover:bg-indigo-600/35 hover:text-indigo-200 hover:shadow-[0_0_0_2px_rgba(0,102,255,0.24),0_10px_24px_rgba(0,102,255,0.24)]"
                                                    >
                                                        <BarChart3 className="w-3.5 h-3.5" />
                                                        Report
                                                    </Link>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm('Are you sure you want to delete this session?')) {
                                                        deleteMutation.mutate(s.id);
                                                    }
                                                }}
                                                disabled={deleteMutation.isPending}
                                                className="rounded p-1.5 text-muted-foreground transition-smooth hover:bg-red-400/10 hover:text-red-400"
                                                title="Delete session"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </motion.div>
                )}

                {/* Create Dialog Overlay */}
                {createDialogOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-border">
                                <h2 className="text-xl font-bold text-foreground">Create Backtesting Session</h2>
                                <p className="text-sm text-muted-foreground mt-1">Configure historical replay parameters.</p>
                            </div>

                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Session Name</label>
                                    <input type="text" required placeholder="e.g. My ES 15m Strategy"
                                        className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] outline-none"
                                        value={form.sessionName} onChange={e => setForm({ ...form, sessionName: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Instrument</label>
                                        <select
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] outline-none"
                                            value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })}
                                        >
                                            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Asset Class</label>
                                        <select
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] outline-none"
                                            value={form.assetClass} onChange={e => setForm({ ...form, assetClass: e.target.value })}
                                        >
                                            <option value="futures">Futures</option>
                                            <option value="forex">Forex</option>
                                            <option value="crypto">Crypto</option>
                                            <option value="stock">Stock</option>
                                            <option value="options">Options</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Timeframe</label>
                                        <select
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] outline-none"
                                            value={form.timeframe} onChange={e => setForm({ ...form, timeframe: e.target.value })}
                                        >
                                            {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Timezone</label>
                                        <select
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] outline-none"
                                            value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}
                                        >
                                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                                        <input type="datetime-local" required
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground outline-none"
                                            value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">End Date</label>
                                        <input type="datetime-local" required
                                            className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground outline-none"
                                            value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Starting Balance ($)</label>
                                    <input type="number" step="0.01" min="100" required
                                        className="w-full bg-muted border border-border rounded-md p-2 text-sm text-foreground outline-none font-mono"
                                        value={form.startingBalance} onChange={e => setForm({ ...form, startingBalance: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        Advanced Configuration
                                    </button>

                                    {showAdvanced && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            className="grid grid-cols-3 gap-3 mt-4"
                                        >
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">Commission/Lot</label>
                                                <input type="number" step="0.1" value={form.commission} onChange={e => setForm({ ...form, commission: Number(e.target.value) })}
                                                    className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">Slippage (pips)</label>
                                                <input type="number" step="0.1" value={form.slippage} onChange={e => setForm({ ...form, slippage: Number(e.target.value) })}
                                                    className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">Spread (pips)</label>
                                                <input type="number" step="0.1" value={form.spread} onChange={e => setForm({ ...form, spread: Number(e.target.value) })}
                                                    className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-border">
                                    <button type="button" onClick={() => setCreateDialogOpen(false)}
                                        className="px-4 py-2 rounded-md bg-transparent hover:bg-muted text-muted-foreground text-sm font-medium transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={createMutation.isPending}
                                        className="px-4 py-2 rounded-md bg-[#00d4aa] hover:bg-[#00e6b8] text-[#0a0a0f] text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {createMutation.isPending && <div className="w-4 h-4 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin" />}
                                        Create Session
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </div>
        </div >
    );
}
