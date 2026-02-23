'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Pause, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, getPnLColor } from '@/lib/utils/formatters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

const statusConfig = {
    active: { icon: Play, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Active' },
    completed: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Completed' },
    paused: { icon: Pause, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Paused' },
};

export default function BacktestingPage() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const queryClient = useQueryClient();
    const { user, token } = useAuth();
    const setUser = useAuthStore((state) => state.setUser);

    // Hydrate user if missing
    useEffect(() => {
        if (token && !user) {
            api.get('/auth/me').then(res => setUser(res.data)).catch(console.error);
        }
    }, [token, user, setUser]);

    // Form state
    const [formData, setFormData] = useState({
        sessionName: '',
        instrument: '',
        timeframe: '15m',
        startDate: '',
        endDate: '',
        startingBalance: '50000'
    });

    const { data: sessions = [], isLoading } = useQuery({
        queryKey: ['backtesting-sessions'],
        queryFn: async () => {
            const { data } = await api.get('/backtesting/sessions');
            return data;
        },
        enabled: !!user // Only fetch if user extends
    });

    const createSessionMutation = useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: async (newSession: any) => {
            await api.post('/backtesting/sessions', newSession);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backtesting-sessions'] });
            setDialogOpen(false);
            setFormData({
                sessionName: '',
                instrument: '',
                timeframe: '15m',
                startDate: '',
                endDate: '',
                startingBalance: '50000'
            });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            alert(`Failed to create session: ${error.response?.data?.message || error.message}`);
        }
    });

    const handleSubmit = () => {
        if (!user) {
            alert('You must be logged in to create a session');
            return;
        }
        if (!formData.sessionName || !formData.instrument || !formData.startDate || !formData.endDate) {
            alert('Please fill in all required fields');
            return;
        }

        const assetClass = ['ES', 'NQ'].includes(formData.instrument) ? 'futures' : 'stock';

        const payload = {
            userId: user.id, // Include user ID
            sessionName: formData.sessionName,
            instrument: formData.instrument,
            assetClass,
            startingBalance: Number(formData.startingBalance),
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
            timeframe: formData.timeframe
        };

        createSessionMutation.mutate(payload);
    };

    return (
        <div className="space-y-6">
            <motion.div
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backtesting</h1>
                    <p className="text-muted-foreground">
                        Practice and refine your trading strategies with historical data.
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" />
                            New Session
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Create Backtesting Session</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="sessionName">Session Name</Label>
                                <Input
                                    id="sessionName"
                                    placeholder="e.g., ES Futures - Breakout Strategy"
                                    value={formData.sessionName}
                                    onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="instrument">Instrument</Label>
                                    <Select
                                        value={formData.instrument}
                                        onValueChange={(value) => setFormData({ ...formData, instrument: value })}
                                    >
                                        <SelectTrigger id="instrument"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ES">ES (S&P 500 Futures)</SelectItem>
                                            <SelectItem value="NQ">NQ (Nasdaq Futures)</SelectItem>
                                            <SelectItem value="AAPL">AAPL</SelectItem>
                                            <SelectItem value="TSLA">TSLA</SelectItem>
                                            <SelectItem value="MSFT">MSFT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="timeframe">Timeframe</Label>
                                    <Select
                                        value={formData.timeframe}
                                        onValueChange={(value) => setFormData({ ...formData, timeframe: value })}
                                    >
                                        <SelectTrigger id="timeframe"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1m">1 Minute</SelectItem>
                                            <SelectItem value="5m">5 Minutes</SelectItem>
                                            <SelectItem value="15m">15 Minutes</SelectItem>
                                            <SelectItem value="1h">1 Hour</SelectItem>
                                            <SelectItem value="1D">Daily</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startingBalance">Starting Balance</Label>
                                <Input
                                    id="startingBalance"
                                    type="number"
                                    placeholder="50000"
                                    value={formData.startingBalance}
                                    onChange={(e) => setFormData({ ...formData, startingBalance: e.target.value })}
                                />
                            </div>
                            <Button className="w-full" onClick={handleSubmit} disabled={createSessionMutation.isPending}>
                                {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>

            {/* Sessions grid */}
            <motion.div
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={{
                    hidden: { opacity: 0 },
                    show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.1 }
                    }
                }}
            >
                <AnimatePresence>
                    {isLoading ? (
                        <motion.div className="col-span-full h-24 flex items-center justify-center text-muted-foreground">
                            Loading sessions...
                        </motion.div>
                    ) : sessions.length === 0 ? (
                        <motion.div className="col-span-full h-24 flex items-center justify-center text-muted-foreground">
                            No backtesting sessions found. Create one to get started.
                        </motion.div>
                    ) : sessions.map((session: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                        const status = statusConfig[session.status as keyof typeof statusConfig] || statusConfig.active;
                        const StatusIcon = status.icon;
                        // Mock stats for now as backend might not return them calculated yet
                        const pnl = session.pnl || 0;
                        const winRate = session.winRate || 0;
                        const totalTrades = session.totalTrades || 0;

                        return (
                            <motion.div
                                key={session.id}
                                layout
                                variants={{
                                    hidden: { opacity: 0, scale: 0.9 },
                                    show: { opacity: 1, scale: 1 }
                                }}
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="h-full"
                            >
                                <Link href={`/backtesting/${session.id}`} className="h-full block">
                                    <Card className="card-hover cursor-pointer h-full">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <CardTitle className="text-base font-semibold leading-tight">
                                                    {session.sessionName}
                                                </CardTitle>
                                                <Badge variant="outline" className={`${status.color} ml-2 shrink-0`}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {status.label}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center gap-4 text-sm">
                                                <Badge variant="secondary">{session.instrument || 'Unknown'}</Badge>
                                                <span className="text-muted-foreground">{session.timeframe || '15m'}</span>
                                                <span className="text-muted-foreground">
                                                    <Clock className="inline h-3 w-3 mr-1" />
                                                    {formatDate(session.createdAt)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">P&L</p>
                                                    <p className={`text-sm font-bold font-mono ${getPnLColor(pnl)}`}>
                                                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Win Rate</p>
                                                    <p className="text-sm font-bold">{winRate}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Trades</p>
                                                    <p className="text-sm font-bold">{totalTrades}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>
        </div >
    );
}
