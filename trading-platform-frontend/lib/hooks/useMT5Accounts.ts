/**
 * useMT5Accounts - Hook for managing saved MT5 live trading accounts.
 * Stores up to 10 accounts in localStorage for quick switching.
 * Passwords are NOT stored — the user re-enters on each connect.
 */

'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'mt5_saved_accounts';
const MAX_LIVE_ACCOUNTS = 10;

export interface SavedMT5Account {
  id: string;
  label: string;
  server: string;
  login: number;
  addedAt: string;
  lastConnectedAt: string | null;
}

function generateId(): string {
  return `mt5_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): SavedMT5Account[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedMT5Account[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(accounts: SavedMT5Account[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function useMT5Accounts() {
  const [accounts, setAccounts] = useState<SavedMT5Account[]>(() => loadFromStorage());
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const addAccount = useCallback(
    (label: string, server: string, login: number): SavedMT5Account | null => {
      const current = loadFromStorage();
      if (current.length >= MAX_LIVE_ACCOUNTS) return null;

      // Prevent duplicate server+login
      const exists = current.find(
        (a) => a.server === server && a.login === login,
      );
      if (exists) return exists;

      const account: SavedMT5Account = {
        id: generateId(),
        label: label || `${server} #${login}`,
        server,
        login,
        addedAt: new Date().toISOString(),
        lastConnectedAt: null,
      };

      const updated = [...current, account];
      saveToStorage(updated);
      setAccounts(updated);
      return account;
    },
    [],
  );

  const removeAccount = useCallback(
    (id: string) => {
      const current = loadFromStorage();
      const updated = current.filter((a) => a.id !== id);
      saveToStorage(updated);
      setAccounts(updated);
      if (activeAccountId === id) {
        setActiveAccountId(null);
      }
    },
    [activeAccountId],
  );

  const renameAccount = useCallback((id: string, newLabel: string) => {
    const current = loadFromStorage();
    const updated = current.map((a) =>
      a.id === id ? { ...a, label: newLabel } : a,
    );
    saveToStorage(updated);
    setAccounts(updated);
  }, []);

  const markConnected = useCallback((id: string) => {
    const current = loadFromStorage();
    const updated = current.map((a) =>
      a.id === id
        ? { ...a, lastConnectedAt: new Date().toISOString() }
        : a,
    );
    saveToStorage(updated);
    setAccounts(updated);
    setActiveAccountId(id);
  }, []);

  const clearActiveAccount = useCallback(() => {
    setActiveAccountId(null);
  }, []);

  const isAtLimit = accounts.length >= MAX_LIVE_ACCOUNTS;
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  return {
    accounts,
    activeAccount,
    activeAccountId,
    isAtLimit,
    maxAccounts: MAX_LIVE_ACCOUNTS,
    addAccount,
    removeAccount,
    renameAccount,
    markConnected,
    clearActiveAccount,
    setActiveAccountId,
  };
}
