'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  PlayCircle,
  BookOpen,
  BarChart3,
  BookMarked,
  Calculator,
  Settings,
  Search,
  TrendingUp,
  UserCircle,
  Moon,
  Sun,
  LogOut,
  ArrowRight,
  FileText,
  BrainCircuit,
  Zap,
  Clock,
  Newspaper,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { tradesApi, type Trade } from '@/lib/api/trades';
import { useAuth } from '@/lib/hooks/useAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'page' | 'action' | 'trade' | 'instrument';
  onSelect: () => void;
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const PAGE_ITEMS = [
  { name: 'Overview',    href: '/overview',     icon: LayoutDashboard, desc: 'Dashboard overview & summary' },
  { name: 'Accounts',    href: '/accounts',     icon: UserCircle,      desc: 'MT5 live trading accounts' },
  { name: 'Backtesting', href: '/backtesting',  icon: PlayCircle,      desc: 'Run strategy backtests' },
  { name: 'Trade Analysis', href: '/trade-analysis', icon: FileText,   desc: 'Review account trade replays' },
  { name: 'Journal',     href: '/journal',      icon: BookOpen,        desc: 'Trade journal & notes' },
  { name: 'Analytics',   href: '/analytics',    icon: BarChart3,       desc: 'Performance analytics' },
  { name: 'AI Report',   href: '/ai-report',    icon: BrainCircuit,    desc: 'AI-powered backtest and trade insights' },
  { name: 'Playbooks',   href: '/playbooks',    icon: BookMarked,      desc: 'Trading playbooks & setups' },
  { name: 'Calculators', href: '/calculators',  icon: Calculator,      desc: 'Position size & risk calculators' },
  { name: 'News',        href: '/news',          icon: Newspaper,       desc: 'Economic news & calendar' },
  { name: 'Settings',    href: '/settings',     icon: Settings,        desc: 'Profile & preferences' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  /* --- Fetch trades once when palette opens --- */
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    // Focus the input after the dialog animation
    const t = setTimeout(() => inputRef.current?.focus(), 100);

    // Load trades silently
    tradesApi.getAll().then((t) => setTrades(t ?? [])).catch(() => setTrades([]));
    return () => clearTimeout(t);
  }, [open]);

  /* --- Build the unified result list --- */
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const items = useMemo<SearchItem[]>(() => {
    const q = query.toLowerCase().trim();
    const results: SearchItem[] = [];
    const safeT = trades ?? [];

    // 1. Pages
    const pageMatches = PAGE_ITEMS.filter(
      (p) =>
        !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q),
    );
    for (const p of pageMatches) {
      results.push({
        id: `page-${p.href}`,
        label: p.name,
        description: p.desc,
        icon: <p.icon className="h-4 w-4" />,
        category: 'page',
        onSelect: () => go(p.href),
      });
    }

    // 2. Quick actions (always show if empty query, or if matching)
    const actions: { label: string; desc: string; icon: React.ReactNode; action: () => void }[] = [
      {
        label: 'Toggle Theme',
        desc: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
        icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          close();
        },
      },
      {
        label: 'New Trade',
        desc: 'Log a new journal trade',
        icon: <TrendingUp className="h-4 w-4" />,
        action: () => go('/journal'),
      },
      {
        label: 'Sign Out',
        desc: 'Log out of your account',
        icon: <LogOut className="h-4 w-4" />,
        action: () => {
          close();
          logout();
        },
      },
    ];

    for (const a of actions) {
      if (!q || a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)) {
        results.push({
          id: `action-${a.label}`,
          label: a.label,
          description: a.desc,
          icon: a.icon,
          category: 'action',
          onSelect: a.action,
        });
      }
    }

    // 3. Trades (only if there's a query, or show recent 5)
    const tradeMatches = q
      ? safeT.filter(
          (t) =>
            t.instrument?.toLowerCase().includes(q) ||
            t.setup?.toLowerCase().includes(q) ||
            t.direction?.toLowerCase().includes(q) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(q)),
        )
      : safeT.slice(0, 5);

    for (const t of tradeMatches.slice(0, 8)) {
      const pnlStr =
        t.pnl !== undefined && t.pnl !== null
          ? ` · ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}`
          : '';
      results.push({
        id: `trade-${t.id}`,
        label: `${t.instrument} ${t.direction}`,
        description: `${t.setup || 'No setup'}${pnlStr} · ${t.status}`,
        icon: <FileText className="h-4 w-4" />,
        category: 'trade',
        onSelect: () => go('/journal'),
      });
    }

    // 4. Unique instruments from trades as quick filters
    if (q.length >= 2) {
      const instruments = [...new Set(safeT.map((t) => t.instrument?.toUpperCase()).filter(Boolean))];
      const instrumentMatches = instruments.filter((i) => i.toLowerCase().includes(q));
      for (const inst of instrumentMatches.slice(0, 4)) {
        // Only add if not already covered by trade results
        if (!results.some((r) => r.id === `instrument-${inst}`)) {
          const instTrades = safeT.filter((t) => t.instrument?.toUpperCase() === inst);
          results.push({
            id: `instrument-${inst}`,
            label: inst,
            description: `${instTrades.length} trade${instTrades.length !== 1 ? 's' : ''} logged`,
            icon: <BarChart3 className="h-4 w-4" />,
            category: 'instrument',
            onSelect: () => go('/journal'),
          });
        }
      }
    }

    return results;
  }, [query, trades, theme, setTheme, close, go, logout]);

  /* --- Keyboard navigation --- */
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onSelect();
      }
    },
    [items, selectedIndex],
  );

  /* --- Group items by category --- */
  const grouped = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items]);

  const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    page: { label: 'Pages', icon: <ArrowRight className="h-3 w-3" /> },
    action: { label: 'Quick Actions', icon: <Zap className="h-3 w-3" /> },
    trade: { label: 'Recent Trades', icon: <Clock className="h-3 w-3" /> },
    instrument: { label: 'Instruments', icon: <TrendingUp className="h-3 w-3" /> },
  };

  // Flatten for index tracking
  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search input */}
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, trades, actions..."
            className="flex-1 bg-transparent py-3.5 px-3 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, groupItems]) => {
              const cat = categoryLabels[category];
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {cat?.icon}
                    {cat?.label || category}
                  </div>
                  {groupItems.map((item) => {
                    const idx = flatIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onSelect}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <span className={`shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.label}</span>
                          {item.description && (
                            <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Search className="h-3 w-3" />
            TradePro Search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
