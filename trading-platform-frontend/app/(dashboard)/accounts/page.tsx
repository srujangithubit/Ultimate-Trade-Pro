'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Copy,
    Check,
    MoreVertical,
    RefreshCw,
    Trash2,
    Pencil,
    Power,
    Terminal,
    TrendingUp,
    TrendingDown,
    Activity,
    DollarSign,
    BarChart3,
    Shield,
    Wifi,
    WifiOff,
    Download,
    X,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { accountsApi, Account } from '@/lib/api/accounts';

// --- Helper Components ---

function StatItem({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color?: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <div
                className={`flex h-7 w-7 items-center justify-center rounded-md ${color || 'bg-muted'}`}
            >
                <Icon className="h-3.5 w-3.5 text-foreground/70" />
            </div>
            <div>
                <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
                <p className="text-sm font-semibold leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
            {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
                <Copy className="h-3.5 w-3.5" />
            )}
        </Button>
    );
}

// --- EA Setup Instructions ---

function EASetupPanel({ apiKey, webhookUrl }: { apiKey: string; webhookUrl: string }) {
    return (
        <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                    <Terminal className="h-4 w-4" /> Quick Setup
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>
                        Download the{' '}
                        <span className="font-mono text-foreground">TradePro_Sync.mq5</span> file
                        from the <span className="font-mono text-foreground">/mt5/</span> directory
                    </li>
                    <li>
                        Copy it to your MT5 terminal:{' '}
                        <span className="font-mono text-xs text-foreground">
                            MQL5/Experts/TradePro_Sync.mq5
                        </span>
                    </li>
                    <li>Open MetaEditor → Compile the EA</li>
                    <li>Attach the EA to any chart</li>
                    <li>Configure the inputs:</li>
                </ol>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">API Key</Label>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                        <span className="flex-1">{apiKey}</span>
                        <CopyButton text={apiKey} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs">
                        <span className="flex-1">{webhookUrl}</span>
                        <CopyButton text={webhookUrl} />
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                    <strong>⚠ MT5 Settings Required:</strong> Go to Tools → Options → Expert
                    Advisors → Enable &quot;Allow WebRequest for listed URL&quot; and add your
                    webhook URL.
                </p>
            </div>
        </div>
    );
}

// --- Account Card ---

function AccountCard({
    account,
    onRename,
    onToggle,
    onRegenerateKey,
    onDelete,
}: {
    account: Account;
    onRename: (id: string, name: string) => void;
    onToggle: (id: string) => void;
    onRegenerateKey: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [newName, setNewName] = useState(account.name);
    const isOnline = account.status === 'CONNECTED';

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: account.currency || 'USD',
            minimumFractionDigits: 2,
        }).format(val);

    const formatTime = (iso: string | null) => {
        if (!iso) return 'Never';
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        if (diffMs < 60000) return 'Just now';
        if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
        if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <>
            <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 border-border/60">
                {/* Status bar at top */}
                <div
                    className={`absolute top-0 left-0 right-0 h-0.5 ${isOnline
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : account.active
                            ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
                            : 'bg-muted'
                        }`}
                />

                <CardHeader className="pb-3 pt-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnline
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-muted text-muted-foreground'
                                    }`}
                            >
                                {isOnline ? (
                                    <Wifi className="h-5 w-5" />
                                ) : (
                                    <WifiOff className="h-5 w-5" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-base">{account.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {account.accountLogin && (
                                        <span className="text-xs text-muted-foreground font-mono">
                                            #{account.accountLogin}
                                        </span>
                                    )}
                                    {account.server && (
                                        <span className="text-xs text-muted-foreground">
                                            • {account.server}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge
                                variant={isOnline ? 'default' : 'secondary'}
                                className={`text-[10px] px-2 py-0.5 ${isOnline
                                    ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                                    : ''
                                    }`}
                            >
                                {isOnline ? 'Connected' : account.active ? 'Offline' : 'Disabled'}
                            </Badge>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                                        <Pencil className="h-4 w-4 mr-2" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onRegenerateKey(account.id)}>
                                        <RefreshCw className="h-4 w-4 mr-2" /> Regenerate API Key
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onToggle(account.id)}>
                                        <Power className="h-4 w-4 mr-2" />{' '}
                                        {account.active ? 'Disable' : 'Enable'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setShowDeleteConfirm(true)}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Key metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatItem
                            label="Balance"
                            value={formatCurrency(Number(account.balance))}
                            icon={DollarSign}
                            color="bg-blue-500/10"
                        />
                        <StatItem
                            label="Equity"
                            value={formatCurrency(Number(account.equity))}
                            icon={TrendingUp}
                            color="bg-emerald-500/10"
                        />
                        <StatItem
                            label="Total P&L"
                            value={formatCurrency(account.totalPnl)}
                            icon={account.totalPnl >= 0 ? TrendingUp : TrendingDown}
                            color={
                                account.totalPnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                            }
                        />
                        <StatItem
                            label="Drawdown"
                            value={`${account.maxDrawdown}%`}
                            icon={Activity}
                            color="bg-orange-500/10"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <StatItem
                            label="Trades"
                            value={account.totalTrades}
                            icon={BarChart3}
                        />
                        <StatItem
                            label="Win Rate"
                            value={`${account.winRate}%`}
                            icon={Shield}
                        />
                        <StatItem
                            label="Last Sync"
                            value={formatTime(account.lastSeen)}
                            icon={RefreshCw}
                        />
                    </div>

                    {/* Broker info */}
                    {account.broker && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                            <span>
                                Broker: <span className="text-foreground">{account.broker}</span>
                            </span>
                            <span>{account.currency}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Rename Dialog */}
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rename Account</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this trading account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Account Name</Label>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="My MT5 Account"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            onClick={() => {
                                onRename(account.id, newName);
                                setRenameOpen(false);
                            }}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete &quot;{account.name}&quot; and all associated
                            trades. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(account.id)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// --- Add Account Flow ---

function AddAccountDialog({
    onAccountCreated,
}: {
    onAccountCreated: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'form' | 'setup'>('form');
    const [name, setName] = useState('');
    const [server, setServer] = useState('');
    const [accountId, setAccountId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const handleCreate = async () => {
        if (!server.trim() || !accountId.trim() || !password.trim()) return;
        setLoading(true);
        try {
            const account = await accountsApi.create({
                name: name.trim() || undefined,
                server: server.trim(),
                accountLogin: accountId.trim(),
                password: password.trim(),
            });
            setCreatedAccount(account);
            setStep('setup');
            onAccountCreated();
        } catch (err) {
            console.error('Failed to create account:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setStep('form');
            setName('');
            setServer('');
            setAccountId('');
            setPassword('');
            setCreatedAccount(null);
        }, 200);
    };

    const isFormValid = server.trim() && accountId.trim() && password.trim();

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Account
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-[#F3F5F9] dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-800">
                {step === 'form' ? (
                    <div className="flex flex-col h-full w-full">
                        <DialogTitle className="sr-only">Connect MT5 Account</DialogTitle>
                        <DialogDescription className="sr-only">Enter your MT5 account credentials to connect your trading account.</DialogDescription>
                        {/* Custom Header matching Design */}
                        <div className="flex items-center justify-between p-4 px-6 pt-6">
                            <button onClick={handleClose} className="flex items-center text-[#1E40AF] dark:text-blue-400 font-medium text-sm hover:opacity-80 transition-opacity">
                                <span className="mr-1.5 text-lg leading-none">←</span> Back
                            </button>
                            <button onClick={handleClose} className="text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded-full transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Logo Area */}
                        <div className="flex flex-col items-center justify-center mt-2 mb-6">
                            {/* Assuming we just use an inline SVG for the MT5 logo or a close approximation based on the image */}
                            <div className="relative w-14 h-14 flex items-center justify-center bg-transparent mb-1">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/MetaTrader_5_icon.svg" alt="MT5 Logo" className="w-12 h-12 drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                {/* Fallback if image fails */}
                                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-400 opacity-0 bg-slate-100 rounded-full">5</div>
                            </div>
                            <h2 className="text-[17px] font-bold text-[#111827] dark:text-white">MT5</h2>
                        </div>

                        {/* Form Body */}
                        <div className="px-6 pb-6 space-y-5">
                            <div className="space-y-1.5">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Name (optional)"
                                    className="h-[52px] bg-transparent border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-400 text-[15px] focus-visible:ring-1 focus-visible:ring-[#1E40AF] focus-visible:border-[#1E40AF]"
                                />
                                <div className="text-[13px] text-[#475569] dark:text-slate-500 font-medium tracking-tight px-1">{name.length}/50</div>
                            </div>

                            <div>
                                <Input
                                    value={server}
                                    onChange={(e) => setServer(e.target.value)}
                                    placeholder="Select Server*"
                                    className="h-[52px] bg-transparent border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-white placeholder:text-[#0F172A] dark:placeholder:text-slate-300 text-[15px] focus-visible:ring-1 focus-visible:ring-[#1E40AF] focus-visible:border-[#1E40AF]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    placeholder="Account ID*"
                                    className="h-[52px] bg-transparent border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-white placeholder:text-[#0F172A] dark:placeholder:text-slate-300 text-[15px] focus-visible:ring-1 focus-visible:ring-[#1E40AF] focus-visible:border-[#1E40AF]"
                                />
                                <div className="relative">
                                    <Input
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Account Password*"
                                        type={showPassword ? 'text' : 'password'}
                                        className="h-[52px] bg-transparent border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-white placeholder:text-[#0F172A] dark:placeholder:text-slate-300 text-[15px] focus-visible:ring-1 focus-visible:ring-[#1E40AF] focus-visible:border-[#1E40AF] pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
                                    >
                                        {showPassword ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 pb-2 px-1">
                                <p className="text-[13px] text-[#1e293b] dark:text-slate-300 font-medium">Server Missing from the list? Just type in the server name</p>
                            </div>
                        </div>

                        {/* Footer Buttons matched to screenshot */}
                        <div className="flex items-center justify-between px-6 pb-6 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="h-11 px-6 bg-transparent border-[#93C5FD] text-[#3B82F6] hover:bg-blue-50 hover:text-[#2563EB] font-semibold text-[15px] rounded-[6px]"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={!isFormValid || loading}
                                className={`h-11 px-8 font-semibold text-[15px] rounded-[6px] ${isFormValid ? 'bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-sm' : 'bg-[#CBD5E1] dark:bg-slate-700 text-[#64748B] dark:text-slate-400 opacity-60'
                                    }`}
                            >
                                {loading ? 'Connecting...' : 'Confirm'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-500" /> Account Connected
                            </DialogTitle>
                            <DialogDescription>
                                Set up the Expert Advisor in your MT5 terminal to start syncing.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            {createdAccount?.apiKey && (
                                <EASetupPanel
                                    apiKey={createdAccount.apiKey}
                                    webhookUrl={apiUrl}
                                />
                            )}
                        </div>
                        <DialogFooter className="mt-6 border-t border-border pt-4">
                            <Button onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page ---

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyDialog, setNewKeyDialog] = useState<{
        open: boolean;
        apiKey: string;
    }>({ open: false, apiKey: '' });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await accountsApi.getAll();
            setAccounts(data);
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
        // Poll for status updates every 30s
        const interval = setInterval(fetchAccounts, 30000);
        return () => clearInterval(interval);
    }, [fetchAccounts]);

    const handleRename = async (id: string, name: string) => {
        try {
            await accountsApi.update(id, { name });
            fetchAccounts();
        } catch (err) {
            console.error('Failed to rename:', err);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await accountsApi.toggle(id);
            fetchAccounts();
        } catch (err) {
            console.error('Failed to toggle:', err);
        }
    };

    const handleRegenerateKey = async (id: string) => {
        try {
            const { apiKey } = await accountsApi.regenerateKey(id);
            setNewKeyDialog({ open: true, apiKey });
        } catch (err) {
            console.error('Failed to regenerate key:', err);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await accountsApi.delete(id);
            fetchAccounts();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const connectedCount = accounts.filter(
        (a) => a.status === 'CONNECTED',
    ).length;
    const totalBalance = accounts.reduce(
        (sum, a) => sum + Number(a.balance),
        0,
    );
    const totalPnl = accounts.reduce((sum, a) => sum + a.totalPnl, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Trading Accounts</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage your MT5 trading accounts and sync trades automatically
                    </p>
                </div>
                <AddAccountDialog onAccountCreated={fetchAccounts} />
            </div>

            {/* Summary bar */}
            {accounts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Accounts</p>
                        <p className="text-xl font-bold">{accounts.length}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Connected</p>
                        <p className="text-xl font-bold text-green-500">{connectedCount}</p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
                        <p className="text-xl font-bold">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                            }).format(totalBalance)}
                        </p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
                        <p
                            className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
                        >
                            {totalPnl >= 0 ? '+' : ''}
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                            }).format(totalPnl)}
                        </p>
                    </Card>
                </div>
            )}

            {/* Account Cards */}
            {loading && accounts.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading accounts...</p>
                    </div>
                </div>
            ) : accounts.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                        <Activity className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
                    <p className="text-muted-foreground text-sm max-w-md mb-6">
                        Add your first MetaTrader 5 account to start syncing your trades
                        automatically. Each account gets a unique API key for the Expert
                        Advisor.
                    </p>
                    <AddAccountDialog onAccountCreated={fetchAccounts} />
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {accounts.map((account) => (
                        <AccountCard
                            key={account.id}
                            account={account}
                            onRename={handleRename}
                            onToggle={handleToggle}
                            onRegenerateKey={handleRegenerateKey}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Regenerated Key Dialog */}
            <Dialog
                open={newKeyDialog.open}
                onOpenChange={(v) => setNewKeyDialog({ ...newKeyDialog, open: v })}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New API Key Generated</DialogTitle>
                        <DialogDescription>
                            Copy this key now — it won&apos;t be shown again. Update the EA input
                            in your MT5 terminal.
                        </DialogDescription>
                    </DialogHeader>
                    <EASetupPanel apiKey={newKeyDialog.apiKey} webhookUrl={apiUrl} />
                    <DialogFooter>
                        <Button
                            onClick={() => setNewKeyDialog({ open: false, apiKey: '' })}
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
