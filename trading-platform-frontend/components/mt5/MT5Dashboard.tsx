/**
 * MT5Dashboard - Main MT5 live trading dashboard component.
 * Supports up to 10 saved live trading accounts with quick switching.
 */

'use client';

import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Power,
  MonitorSmartphone,
  Plus,
  Trash2,
  Pencil,
  User,
  ChevronRight,
  Shield,
  Server,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { useMT5 } from './MT5Context';
import MT5ConnectDialog from './MT5ConnectDialog';
import MT5AccountSummary from './MT5AccountSummary';
import MT5LiveTrades from './MT5LiveTrades';
import MT5TradeHistory from './MT5TradeHistory';
import MT5Analytics from './MT5Analytics';
import {
  useMT5Accounts,
  type SavedMT5Account,
} from '@/lib/hooks/useMT5Accounts';

// --- Account Switcher Sidebar ---

function MT5AccountSwitcher({
  savedAccounts,
  onConnect,
  onRemove,
  onRename,
  onAddNew,
  activeAccountId,
  isAtLimit,
  maxAccounts,
  isAuthenticated,
}: {
  savedAccounts: SavedMT5Account[];
  onConnect: (account: SavedMT5Account) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAddNew: () => void;
  activeAccountId: string | null;
  isAtLimit: boolean;
  maxAccounts: number;
  isAuthenticated: boolean;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const accountToDelete = savedAccounts.find((a) => a.id === deleteId);

  return (
    <motion.div 
      className="space-y-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Header with gradient accent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-linear-to-b from-blue-500 to-purple-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Saved Accounts
          </h3>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
          <Server className="h-3 w-3" />
          {savedAccounts.length}/{maxAccounts}
        </span>
      </div>

      {/* Account List with stagger animation */}
      <div className="space-y-1.5">
        {savedAccounts.map((acc, index) => {
          const isActive = acc.id === activeAccountId && isAuthenticated;
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.01, x: 2 }}
              whileTap={{ scale: 0.99 }}
              className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all cursor-pointer ${
                isActive
                  ? 'border-green-500/30 bg-linear-to-r from-green-500/5 to-emerald-500/5 shadow-sm shadow-green-500/5'
                  : 'border-border/60 bg-card hover:bg-accent/50 hover:border-border'
              }`}
              onClick={() => !isActive && onConnect(acc)}
            >
              {/* Active indicator line */}
              {isActive && (
                <motion.div 
                  layoutId="activeAccountIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-linear-to-b from-green-400 to-emerald-500"
                  transition={{ type: 'spring', bounce: 0.2 }}
                />
              )}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-green-500/15 text-green-500'
                    : 'bg-muted text-muted-foreground group-hover:bg-accent'
                }`}
              >
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{acc.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {acc.server} • #{acc.login}
                </p>
              </div>
              {isActive ? (
                <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20">
                  Live
                </Badge>
              ) : (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameId(acc.id);
                      setRenameValue(acc.label);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(acc.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Add Account Button */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors"
          onClick={onAddNew}
          disabled={isAtLimit}
        >
          <Plus className="h-3.5 w-3.5" />
          {isAtLimit ? `Limit reached (${maxAccounts})` : 'Add Account'}
        </Button>
      </motion.div>

      {isAtLimit && (
        <p className="text-[11px] text-yellow-600 dark:text-yellow-400 text-center">
          Remove an account to add a new one
        </p>
      )}

      {/* Rename Dialog */}
      <Dialog
        open={renameId !== null}
        onOpenChange={(v) => !v && setRenameId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Account</DialogTitle>
            <DialogDescription>
              Enter a new display name for this account.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Account name"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (renameId && renameValue.trim()) {
                  onRename(renameId, renameValue.trim());
                  setRenameId(null);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Account</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{accountToDelete?.label}&quot; from your saved
              accounts? This only removes it from this list — no data is
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  onRemove(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// --- Dashboard Content ---

function MT5DashboardContent({ activeTab = 'trading' }: { activeTab?: 'trading' | 'analytics' }) {
  const { status, disconnect, account, connect, isConnecting } = useMT5();
  const {
    accounts: savedAccounts,
    activeAccountId,
    isAtLimit,
    maxAccounts,
    addAccount,
    removeAccount,
    renameAccount,
    markConnected,
    clearActiveAccount,
  } = useMT5Accounts();

  const [connectTarget, setConnectTarget] = useState<SavedMT5Account | null>(
    null,
  );
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Handle connecting to a saved account (needs password)
  const handleConnectSaved = (acc: SavedMT5Account) => {
    setConnectTarget(acc);
    setSwitchPassword('');
    setSwitchError(null);
  };

  const handleConfirmSwitch = async () => {
    if (!connectTarget || !switchPassword.trim()) return;
    setSwitchError(null);

    // Disconnect current if authenticated
    if (status.authenticated) {
      await disconnect();
      clearActiveAccount();
    }

    const success = await connect({
      server: connectTarget.server,
      login: connectTarget.login,
      password: switchPassword,
    });

    if (success) {
      markConnected(connectTarget.id);
      setConnectTarget(null);
      setSwitchPassword('');
    } else {
      setSwitchError('Failed to connect. Check your password.');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    clearActiveAccount();
  };

  // Called when user successfully adds a new account via the MT5ConnectDialog
  const handleNewAccountConnected = (
    server: string,
    login: number,
    label?: string,
  ) => {
    const saved = addAccount(label || `${server} #${login}`, server, login);
    if (saved) {
      markConnected(saved.id);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Left: Account Switcher */}
      <div className="w-64 shrink-0">
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm p-4">
          <MT5AccountSwitcher
            savedAccounts={savedAccounts}
            onConnect={handleConnectSaved}
            onRemove={removeAccount}
            onRename={renameAccount}
            onAddNew={() => setShowAddDialog(true)}
            activeAccountId={activeAccountId}
            isAtLimit={isAtLimit}
            maxAccounts={maxAccounts}
            isAuthenticated={status.authenticated}
          />
        </Card>
      </div>

      {/* Right: Dashboard */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Connection Status Header */}
        <motion.div 
          className="flex items-center justify-between rounded-xl border bg-card/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  status.authenticated
                    ? 'bg-linear-to-br from-green-500/15 to-emerald-500/15 text-green-500'
                    : status.connected
                      ? 'bg-linear-to-br from-yellow-500/15 to-amber-500/15 text-yellow-500'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {status.authenticated ? (
                  <Wifi className="h-5 w-5" />
                ) : (
                  <WifiOff className="h-5 w-5" />
                )}
              </div>
              {status.authenticated && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-card" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">MT5 Live Connection</h3>
                <Badge
                  variant={status.authenticated ? 'default' : 'secondary'}
                  className={`text-[10px] px-2 py-0 ${
                    status.authenticated
                      ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                      : status.connected
                        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                        : ''
                  }`}
                >
                  {status.authenticated
                    ? 'Connected'
                    : status.connected
                      ? 'Bridge Ready'
                      : 'Disconnected'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.authenticated && account
                  ? `${account.name} — ${account.server} #${account.login}`
                  : 'Select an account or add a new one to connect'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status.authenticated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg"
                  onClick={handleDisconnect}
                >
                  <Power className="h-3.5 w-3.5" /> Disconnect
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Not Connected State */}
        <AnimatePresence>
          {!status.authenticated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed border-2 relative overflow-hidden">
                {/* Decorative gradient */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-500/2 via-transparent to-purple-500/2" />
                <CardContent className="relative flex flex-col items-center justify-center py-16 text-center">
                  <motion.div 
                    className="relative mb-6"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/10">
                      <MonitorSmartphone className="h-8 w-8 text-blue-500/60" />
                    </div>
                    <div className="absolute -inset-3 rounded-3xl bg-linear-to-r from-blue-500/5 to-purple-500/5 blur-xl -z-10" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2">
                    {savedAccounts.length > 0
                      ? 'Select an Account'
                      : 'No Accounts Yet'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-5">
                    {savedAccounts.length > 0
                      ? 'Click on a saved account from the sidebar to connect, or add a new one.'
                      : 'Add your first MT5 live trading account to get started. You can save up to 10 accounts.'}
                  </p>
                  <div className="flex items-center gap-3 mb-5">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] gap-1 ${
                        status.connected 
                          ? 'border-green-500/20 text-green-600 dark:text-green-400' 
                          : 'border-red-500/20 text-red-600 dark:text-red-400'
                      }`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                      {status.connected ? 'Bridge Online' : 'Bridge Offline'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Shield className="h-3 w-3" />
                      Secure Connection
                    </Badge>
                  </div>
                  {savedAccounts.length === 0 && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        className="gap-2 rounded-lg"
                        onClick={() => setShowAddDialog(true)}
                      >
                        <Plus className="h-4 w-4" /> Add First Account
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connected: Show dashboard with stagger animations */}
        <AnimatePresence>
          {status.authenticated && activeTab === 'trading' && (
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <MT5AccountSummary />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <MT5LiveTrades />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <MT5TradeHistory />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {status.authenticated && activeTab === 'analytics' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <MT5Analytics />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Switch Account Password Dialog */}
      <Dialog
        open={connectTarget !== null}
        onOpenChange={(v) => !v && setConnectTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" /> Connect to Account
            </DialogTitle>
            <DialogDescription>
              Enter the password for{' '}
              <strong>{connectTarget?.label}</strong> ({connectTarget?.server} #{connectTarget?.login})
            </DialogDescription>
          </DialogHeader>
          {switchError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {switchError}
            </div>
          )}
          <Input
            type="password"
            value={switchPassword}
            onChange={(e) => setSwitchPassword(e.target.value)}
            placeholder="MT5 Password"
            disabled={isConnecting}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmSwitch()}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isConnecting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmSwitch}
              disabled={!switchPassword.trim() || isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Account Dialog (standalone, saves on connect) */}
      <MT5ConnectDialog
        externalOpen={showAddDialog}
        onExternalClose={() => setShowAddDialog(false)}
        onConnected={handleNewAccountConnected}
        disabled={isAtLimit}
      />
    </div>
  );
}

export default function MT5Dashboard({ activeTab = 'trading' }: { activeTab?: 'trading' | 'analytics' }) {
  return <MT5DashboardContent activeTab={activeTab} />;
}
