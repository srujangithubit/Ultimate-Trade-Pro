'use client';

import { useState } from 'react';
import {
    Search,
    Plus,
    Filter,
    Download,
    ArrowUpDown,
    Tag,
    CalendarDays,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate, getPnLColor } from '@/lib/utils/formatters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';

// Define Trade interface locally or import if available
interface Trade {
    id: string;
    symbol: string;

    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    setup: string;
    entryDate: string;
    exitDate?: string;
    pnl?: number;
    pnlPercent?: number;
    tags: string[];
    notes?: string;
    status: string;
    fees?: number;
}

export default function JournalPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const queryClient = useQueryClient();

    // Helper to get current local datetime string for input
    const getCurrentDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    // Form state
    const [formData, setFormData] = useState({
        instrument: '',
        direction: 'LONG',
        entryPrice: '',
        exitPrice: '',
        quantity: '',
        setup: '',
        entryDate: getCurrentDateTime(),
        exitDate: '',
        tags: '',
        notes: ''
    });

    const { data: trades = [], isLoading } = useQuery({
        queryKey: ['trades'],
        queryFn: async () => {
            const { data } = await api.get<{ trades: Trade[]; total: number }>('/trades');
            return Array.isArray(data) ? data : (data?.trades || []);
        }
    });

    const createTradeMutation = useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: async (newTrade: any) => {
            await api.post('/trades', newTrade);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trades'] });
            setDialogOpen(false);
            setFormData({
                instrument: '',
                direction: 'LONG',
                entryPrice: '',
                exitPrice: '',
                quantity: '',
                setup: '',
                entryDate: getCurrentDateTime(),
                exitDate: '',
                tags: '',
                notes: ''
            });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            alert(`Failed to save trade: ${error.response?.data?.message || error.message}`);
        }
    });

    const filteredTrades = trades.filter((trade) =>
        (trade.symbol?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (trade.setup?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    // Calculate P&L for display
    const tradesWithPnL = filteredTrades.map(trade => {
        let pnl = trade.pnl;
        let pnlPercent = trade.pnlPercent;

        if (trade.exitPrice && trade.quantity) {
            const multiplier = trade.direction.toUpperCase() === 'LONG' ? 1 : -1;
            // Simple P&L: (Exit - Entry) * Qty * Direction
            // Fees should be subtracted if available
            const rawPnL = (trade.exitPrice - trade.entryPrice) * trade.quantity * multiplier;
            pnl = rawPnL - (trade.fees || 0);

            const investmentPromise = trade.entryPrice * trade.quantity;
            if (investmentPromise !== 0) {
                pnlPercent = Number(((pnl / investmentPromise) * 100).toFixed(2));
            }
        }

        return { ...trade, pnl, pnlPercent };
    });

    const exportCSV = () => {
        if (tradesWithPnL.length === 0) return;

        const headers = [
            'Date', 'Symbol', 'Direction', 'Entry Price', 'Exit Price',
            'Quantity', 'P&L ($)', 'P&L (%)', 'Setup', 'Status', 'Tags', 'Notes',
        ];

        const escapeCSV = (val: string) => {
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        };

        const rows = tradesWithPnL.map((t) => [
            t.entryDate ? new Date(t.entryDate).toLocaleDateString() : '',
            t.symbol || '',
            t.direction || '',
            t.entryPrice?.toString() || '',
            t.exitPrice?.toString() || '',
            t.quantity?.toString() || '',
            t.pnl !== undefined && t.pnl !== null ? t.pnl.toFixed(2) : '',
            t.pnlPercent !== undefined && t.pnlPercent !== null ? t.pnlPercent.toFixed(2) : '',
            t.setup || '',
            t.status || '',
            (t.tags || []).join('; '),
            (t.notes || '').replace(/\n/g, ' '),
        ].map(escapeCSV));

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tradepro-journal-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleSubmit = () => {
        if (!formData.entryDate) {
            alert('Please select an Entry Date');
            return;
        }

        try {
            const payload = {
                symbol: formData.instrument, // Changed to match backend CreateTradeDto
                direction: formData.direction,
                entryPrice: Number(formData.entryPrice),
                exitPrice: formData.exitPrice ? Number(formData.exitPrice) : undefined,
                quantity: Number(formData.quantity),
                setup: formData.setup,
                notes: formData.notes,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                entryDate: new Date(formData.entryDate).toISOString(),
                exitDate: formData.exitDate ? new Date(formData.exitDate).toISOString() : undefined,
            };
            createTradeMutation.mutate(payload);
        } catch (_e) {
            alert('Invalid date format');
        }
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
                    <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
                    <p className="text-muted-foreground">
                        Log, review, and learn from every trade you make.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 transition-transform hover:scale-105 active:scale-95"
                        onClick={exportCSV}
                        disabled={tradesWithPnL.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                                <Plus className="h-4 w-4" />
                                Add Trade
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Log New Trade</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="instrument">Instrument</Label>
                                        <Input
                                            id="instrument"
                                            placeholder="e.g., AAPL"
                                            value={formData.instrument}
                                            onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="direction">Direction</Label>
                                        <Select
                                            value={formData.direction}
                                            onValueChange={(value) => setFormData({ ...formData, direction: value })}
                                        >
                                            <SelectTrigger id="direction"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LONG">Long</SelectItem>
                                                <SelectItem value="SHORT">Short</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="entryPrice">Entry Price</Label>
                                        <Input
                                            id="entryPrice"
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.entryPrice}
                                            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="exitPrice">Exit Price</Label>
                                        <Input
                                            id="exitPrice"
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.exitPrice}
                                            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Quantity</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            placeholder="100"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="setup">Setup</Label>
                                        <Input
                                            id="setup"
                                            placeholder="e.g., Breakout"
                                            value={formData.setup}
                                            onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="entryDate">Entry Date</Label>
                                        <Input
                                            id="entryDate"
                                            type="datetime-local"
                                            value={formData.entryDate}
                                            onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="exitDate">Exit Date</Label>
                                        <Input
                                            id="exitDate"
                                            type="datetime-local"
                                            value={formData.exitDate}
                                            onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tags">Tags</Label>
                                    <Input
                                        id="tags"
                                        placeholder="momentum, earnings (comma separated)"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="What was your reasoning? What did you learn?"
                                        rows={3}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleSubmit} disabled={createTradeMutation.isPending}>
                                    {createTradeMutation.isPending ? 'Saving...' : 'Save Trade'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </motion.div>

            {/* Search & filters */}
            <motion.div
                className="flex flex-col gap-3 sm:flex-row"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by instrument, setup, or tag..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                        <CalendarDays className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>

            {/* Trade detail modal */}
            <Dialog open={!!selectedTrade} onOpenChange={(open) => !open && setSelectedTrade(null)}>
                <DialogContent className="sm:max-w-lg">
                    {selectedTrade && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    <span>{selectedTrade.symbol}</span>
                                    <Badge
                                        className={selectedTrade.direction.toUpperCase() === 'LONG' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
                                    >
                                        {selectedTrade.direction.toUpperCase()}
                                    </Badge>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Entry Price</p>
                                        <p className="font-mono font-semibold">{formatCurrency(selectedTrade.entryPrice)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Exit Price</p>
                                        <p className="font-mono font-semibold">{selectedTrade.exitPrice ? formatCurrency(selectedTrade.exitPrice) : '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Quantity</p>
                                        <p className="font-mono font-semibold">{selectedTrade.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">P&L</p>
                                        <p className={`font-mono font-semibold ${getPnLColor(selectedTrade.pnl || 0)}`}>
                                            {selectedTrade.pnl && selectedTrade.pnl >= 0 ? '+' : ''}{selectedTrade.pnl ? formatCurrency(selectedTrade.pnl) : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Entry Date</p>
                                        <p className="text-sm">{selectedTrade.entryDate ? formatDate(selectedTrade.entryDate, 'MMM dd, yyyy HH:mm') : '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Exit Date</p>
                                        <p className="text-sm">{selectedTrade.exitDate ? formatDate(selectedTrade.exitDate, 'MMM dd, yyyy HH:mm') : '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">Setup</p>
                                    <Badge variant="outline">{selectedTrade.setup}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">Tags</p>
                                    <div className="flex gap-1 flex-wrap">
                                        {selectedTrade.tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="text-xs">
                                                <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Trades table */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Card className="overflow-hidden border-border/50 shadow-sm">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:text-foreground">
                                        Instrument <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead>Setup</TableHead>
                                    <TableHead className="text-right">Entry</TableHead>
                                    <TableHead className="text-right">Exit</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:text-foreground">
                                        P&L <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead className="text-right">Return</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                    <TableHead>Tags</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            Loading trades...
                                        </TableCell>
                                    </TableRow>
                                ) : tradesWithPnL.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            No trades found.
                                        </TableCell>
                                    </TableRow>
                                ) : tradesWithPnL.map((trade) => (
                                    <TableRow
                                        key={trade.id}
                                        className="cursor-pointer hover:bg-accent/50"
                                        onClick={() => setSelectedTrade(trade)}
                                    >
                                        <TableCell className="font-semibold">{trade.symbol}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={trade.direction.toUpperCase() === 'LONG' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}
                                            >
                                                {trade.direction.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{trade.setup}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(trade.entryPrice)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold font-mono ${getPnLColor(trade.pnl || 0)}`}>
                                            {trade.pnl && trade.pnl >= 0 ? '+' : ''}{trade.pnl ? formatCurrency(trade.pnl) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono text-sm ${getPnLColor(trade.pnlPercent || 0)}`}>
                                            {trade.pnlPercent && trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent ? `${trade.pnlPercent}%` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {trade.entryDate ? formatDate(trade.entryDate) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {trade.tags.slice(0, 2).map((tag: string) => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
        </div >
    );
}
