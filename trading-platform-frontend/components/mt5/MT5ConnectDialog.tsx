/**
 * MT5ConnectDialog - Dialog for connecting to an MT5 account via the Python bridge.
 * Supports external open/close control and fires onConnected with account details.
 */

'use client';

import React, { useState } from 'react';
import { Wifi, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useMT5 } from './MT5Context';

interface MT5ConnectDialogProps {
  /** Control open state externally */
  externalOpen?: boolean;
  /** Called when the dialog should close */
  onExternalClose?: () => void;
  /** Called after a successful connection with the account details */
  onConnected?: (server: string, login: number, label?: string) => void;
  /** Whether adding new accounts is disabled (at limit) */
  disabled?: boolean;
}

export default function MT5ConnectDialog({
  externalOpen,
  onExternalClose,
  onConnected,
  disabled,
}: MT5ConnectDialogProps) {
  const { connect, disconnect, status, isConnecting, error } = useMT5();
  const [server, setServer] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Determine open state — always controlled externally
  const isOpen = externalOpen ?? false;

  const resetForm = () => {
    setServer('');
    setLogin('');
    setPassword('');
    setLabel('');
    setLocalError(null);
    setShowPassword(false);
  };

  const handleConnect = async () => {
    if (!server.trim() || !login.trim() || !password.trim()) {
      setLocalError('All fields are required');
      return;
    }

    setLocalError(null);
    const loginNum = parseInt(login, 10);
    if (isNaN(loginNum)) {
      setLocalError('Login must be a number');
      return;
    }

    // Disconnect existing connection first if authenticated
    if (status.authenticated) {
      await disconnect();
    }

    const success = await connect({ server, login: loginNum, password });
    if (success) {
      onConnected?.(server, loginNum, label.trim() || undefined);
      onExternalClose?.();
      resetForm();
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onExternalClose?.();
      resetForm();
    }
  };

  const isFormValid = server.trim() && login.trim() && password.trim();
  const displayError = localError || error;

  if (disabled) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-115">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" /> Add MT5 Live Account
          </DialogTitle>
          <DialogDescription>
            Enter your MT5 credentials to connect. The account will be saved for quick switching.
            Your password is never stored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {displayError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {displayError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mt5-label">Account Label (optional)</Label>
            <Input
              id="mt5-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My Demo Account"
              disabled={isConnecting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mt5-server">Server</Label>
            <Input
              id="mt5-server"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="e.g. MetaQuotes-Demo"
              disabled={isConnecting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mt5-login">Login (Account Number)</Label>
            <Input
              id="mt5-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="e.g. 12345678"
              disabled={isConnecting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mt5-password">Password</Label>
            <div className="relative">
              <Input
                id="mt5-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="MT5 Password"
                disabled={isConnecting}
                className="pr-10"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
            <strong>Note:</strong> Your password is used only for this connection and is not saved.
            You will be asked to re-enter it when switching accounts.
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isConnecting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleConnect} disabled={!isFormValid || isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...
              </>
            ) : (
              'Connect & Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
