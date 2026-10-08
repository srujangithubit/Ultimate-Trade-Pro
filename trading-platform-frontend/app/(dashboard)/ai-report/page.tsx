'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BrainCircuit,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { accountsApi } from '@/lib/api/accounts';
import { aiReportApi } from '@/lib/api/ai-report';
import { mt5Api } from '@/lib/api/mt5';
import { api } from '@/lib/api/client';
import { BacktestSession } from '@/lib/types/backtesting';

const BACKTEST_BASES = ['/backtesting', '/api/backtesting'];
const ACCOUNT_TRADES_SCOPE = '__ACCOUNT_TRADES__';
const MT5_SAVED_ACCOUNTS_STORAGE_KEY = 'mt5_saved_accounts';

type SavedMt5Account = {
  label?: string;
  server?: string;
  login?: number;
};

type Mt5LiveAccount = {
  login: number;
  server: string;
  balance: number;
  equity: number;
  currency?: string;
  name?: string;
};

async function backtestingRequest<T>(path: string) {
  let lastError: unknown;
  for (const base of BACKTEST_BASES) {
    try {
      return await api.get<T>(`${base}${path}`);
    } catch (error) {
      lastError = error;
      if ((error as { response?: { status?: number } })?.response?.status !== 404) {
        throw error;
      }
    }
  }
  throw lastError;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function toLabel(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toLabel).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${toLabel(v)}`)
      .join(', ');
  }
  return String(value);
}

function priorityClass(priority: string) {
  if (priority === 'high') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
  if (priority === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
}

export default function AiReportPage() {
  const [accountId, setAccountId] = useState<string>('ALL');
  const [sessionId, setSessionId] = useState<string>(ACCOUNT_TRADES_SCOPE);
  const syncedMt5AccountsRef = useRef<Set<string>>(new Set());
  const lastCurrentMt5SyncKeyRef = useRef<string>('');
  const isAccountsMode = sessionId === ACCOUNT_TRADES_SCOPE;

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'ai-report-filter'],
    queryFn: () => accountsApi.getAll(),
  });
  const accounts = accountsQuery.data || [];
  const mt5Accounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          Boolean(account.accountLogin && String(account.accountLogin).trim()) &&
          Boolean(account.server && String(account.server).trim()),
      ),
    [accounts],
  );

  const selectableAccounts = useMemo(() => {
    if (sessionId !== ACCOUNT_TRADES_SCOPE) {
      return accounts;
    }
    return mt5Accounts.length > 0 ? mt5Accounts : accounts;
  }, [accounts, mt5Accounts, sessionId]);

  const sessionsQuery = useQuery({
    queryKey: ['backtest-sessions', 'ai-report-filter'],
    queryFn: async () => {
      try {
        const response = await backtestingRequest<
          BacktestSession[] | { sessions?: BacktestSession[] }
        >('/sessions');

        const payload = response.data;
        if (Array.isArray(payload)) {
          return payload;
        }

        return Array.isArray(payload?.sessions) ? payload.sessions : [];
      } catch (error) {
        if ((error as { response?: { status?: number } })?.response?.status === 500) {
          return [];
        }
        throw error;
      }
    },
  });
  const sessions = sessionsQuery.data || [];

  useEffect(() => {
    if (accountId === 'ALL') {
      return;
    }

    const stillExists = selectableAccounts.some((account) => account.id === accountId);
    if (!stillExists) {
      setAccountId('ALL');
    }
  }, [accountId, selectableAccounts]);

  useEffect(() => {
    if (sessionId === ACCOUNT_TRADES_SCOPE) {
      return;
    }

    const stillExists = sessions.some((session) => session.id === sessionId);
    if (!stillExists) {
      setSessionId(ACCOUNT_TRADES_SCOPE);
    }
  }, [sessionId, sessions]);

  useEffect(() => {
    if (sessionId === ACCOUNT_TRADES_SCOPE) {
      return;
    }

    const selectedSession = sessions.find((session) => session.id === sessionId);
    const sessionAccountId = selectedSession?.accountId;

    if (!sessionAccountId) {
      return;
    }

    if (accountId === 'ALL' || accountId !== sessionAccountId) {
      setAccountId(sessionAccountId);
    }
  }, [sessionId, sessions, accountId]);

  const reportQuery = useQuery({
    queryKey: ['ai-report', accountId, sessionId],
    queryFn: () =>
      aiReportApi.getReport({
        accountId: accountId === 'ALL' ? undefined : accountId,
        sessionId: sessionId === ACCOUNT_TRADES_SCOPE ? undefined : sessionId,
      }),
  });

  useEffect(() => {
    if (!isAccountsMode) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    async function syncSavedMt5AccountsToBackend() {
      const raw = window.localStorage.getItem(MT5_SAVED_ACCOUNTS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      let savedAccounts: SavedMt5Account[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          savedAccounts = parsed;
        }
      } catch {
        return;
      }

      let createdAny = false;

      for (const saved of savedAccounts) {
        const server = (saved.server || '').trim();
        const login = String(saved.login || '').trim();

        if (!server || !login) {
          continue;
        }

        const syncKey = `${server}:${login}`;
        if (syncedMt5AccountsRef.current.has(syncKey)) {
          continue;
        }

        const existsInBackend = accounts.some(
          (account) =>
            (account.server || '').trim() === server &&
            (account.accountLogin || '').trim() === login,
        );

        if (existsInBackend) {
          syncedMt5AccountsRef.current.add(syncKey);
          continue;
        }

        try {
          await accountsApi.create({
            name: (saved.label || `${server} #${login}`).trim(),
            broker: server,
            server,
            accountLogin: login,
          });

          syncedMt5AccountsRef.current.add(syncKey);
          createdAny = true;
        } catch {
          // Silent retry on next render/focus when account list changes.
        }
      }

      if (createdAny && !cancelled) {
        await Promise.all([accountsQuery.refetch(), reportQuery.refetch()]);
      }
    }

    void syncSavedMt5AccountsToBackend();

    return () => {
      cancelled = true;
    };
  }, [accounts, accountsQuery, reportQuery, isAccountsMode]);

  useEffect(() => {
    if (!isAccountsMode) {
      return;
    }

    let cancelled = false;

    async function syncCurrentMt5ConnectionToBackend() {
      try {
        const status = await mt5Api.getStatus();
        if (!status?.authenticated) {
          return;
        }

        const response = (await mt5Api.getAccount()) as {
          data?: Mt5LiveAccount;
        };
        const live = response?.data;
        if (!live) {
          return;
        }

        const login = String(live.login || '').trim();
        const server = (live.server || '').trim();
        if (!login || !server) {
          return;
        }

        const balance = Number(live.balance) || 0;
        const equity = Number(live.equity) || 0;
        const nowIso = new Date().toISOString();
        const syncKey = `${server}:${login}:${balance}:${equity}`;
        if (lastCurrentMt5SyncKeyRef.current === syncKey) {
          return;
        }

        let didWrite = false;

        const existing = accounts.find(
          (account) =>
            (account.accountLogin || '').trim() === login &&
            (account.server || '').trim() === server,
        );

        if (existing) {
          await accountsApi.update(existing.id, {
            name: existing.name || live.name || `${server} #${login}`,
            broker: server,
            accountType: existing.accountType || 'live',
            currency: live.currency || existing.currency,
            server,
            accountLogin: login,
            balance,
            equity,
            lastSeen: nowIso,
          });
          didWrite = true;
        } else {
          await accountsApi.create({
            name: live.name || `${server} #${login}`,
            broker: server,
            accountType: 'live',
            currency: live.currency || 'USD',
            server,
            accountLogin: login,
            balance,
            equity,
            lastSeen: nowIso,
          });
          didWrite = true;
        }

        if (didWrite) {
          lastCurrentMt5SyncKeyRef.current = syncKey;
        }

        if (!cancelled && didWrite) {
          await Promise.all([accountsQuery.refetch(), reportQuery.refetch()]);
        }
      } catch {
        // Keep silent; AI Report should still load with existing account data.
      }
    }

    void syncCurrentMt5ConnectionToBackend();

    return () => {
      cancelled = true;
    };
  }, [accounts, accountsQuery, reportQuery, isAccountsMode]);

  const report = reportQuery.data;

  const strengths = useMemo(
    () => (report?.ai?.strengths || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const weaknesses = useMemo(
    () => (report?.ai?.weaknesses || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const aiActions = useMemo(
    () => (report?.ai?.actions || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const aiCrunching = useMemo(
    () => (report?.ai?.insights?.crunchingNumbers || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const aiBlindspots = useMemo(
    () => (report?.ai?.insights?.findingBlindspots || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const aiMistakes = useMemo(
    () => (report?.ai?.insights?.identifyingMistakes || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const aiPlan = useMemo(
    () => (report?.ai?.insights?.buildingActionPlan || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const deepAssetInsights = useMemo(
    () => (report?.ai?.deepInsights?.assetInsights || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const deepTimingInsights = useMemo(
    () => (report?.ai?.deepInsights?.timingInsights || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const deepBehaviorInsights = useMemo(
    () => (report?.ai?.deepInsights?.behavioralInsights || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const deepRiskInsights = useMemo(
    () => (report?.ai?.deepInsights?.riskInsights || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const deepExecutionPlan = useMemo(
    () => (report?.ai?.deepInsights?.executionPlan || []).map((item) => toLabel(item)).filter(Boolean),
    [report],
  );

  const reportAccountsById = useMemo(() => {
    const map = new Map<string, { closedTradeCount: number; totalPnl: number }>();
    for (const account of report?.accountsSnapshot.accounts || []) {
      map.set(account.id, {
        closedTradeCount: account.closedTradeCount,
        totalPnl: account.totalPnl,
      });
    }
    return map;
  }, [report]);

  const wiredAccounts = useMemo(() => {
    const selected =
      accountId === 'ALL'
        ? selectableAccounts
        : selectableAccounts.filter((account) => account.id === accountId);

    return selected.map((account) => {
      const aiStats = reportAccountsById.get(account.id);
      return {
        ...account,
        closedTradeCount: aiStats?.closedTradeCount || 0,
        aiTotalPnl: aiStats?.totalPnl || 0,
      };
    });
  }, [accountId, selectableAccounts, reportAccountsById]);

  const wiredConnectedAccounts = useMemo(
    () => wiredAccounts.filter((account) => account.status === 'CONNECTED').length,
    [wiredAccounts],
  );

  const wiredTotalBalance = useMemo(
    () => wiredAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0),
    [wiredAccounts],
  );

  const wiredTotalEquity = useMemo(
    () => wiredAccounts.reduce((sum, account) => sum + (Number(account.equity) || 0), 0),
    [wiredAccounts],
  );

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.32),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/10">
                Performance Intelligence
              </Badge>
              <CardTitle className="text-3xl font-semibold tracking-tight text-white">
                AI Report
              </CardTitle>
              <p className="max-w-3xl text-sm text-blue-100/85">
                Institutional-grade intelligence layer for your journal and account activity. This report fuses
                trade behavior, session performance, account health, and execution discipline into one decision-ready view.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="w-72 border-white/15 bg-black/30 text-white">
                  <SelectValue placeholder="Choose data source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ACCOUNT_TRADES_SCOPE}>Accounts Trades (Journal)</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.instrument} {session.timeframe} • {new Date(session.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-60 border-white/15 bg-black/30 text-white">
                  <SelectValue placeholder="Filter account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Accounts</SelectItem>
                  {selectableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.accountLogin
                        ? ` • ${account.accountLogin}`
                        : ` • ${account.id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={async () => {
                  await Promise.all([
                    accountsQuery.refetch(),
                    sessionsQuery.refetch(),
                    reportQuery.refetch(),
                  ]);
                }}
                className="border-white/20 bg-black/20 text-white hover:bg-black/35"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Badge className="border-white/20 bg-white/5 text-blue-100 hover:bg-white/5">
                {sessionId === ACCOUNT_TRADES_SCOPE
                  ? 'Mode: Accounts Trades'
                  : 'Mode: Backtest Session'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {reportQuery.isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-28 animate-pulse border-border/60 bg-muted/30" />
          ))}
        </div>
      )}

      {reportQuery.isError && (
        <Card className="border-rose-500/40 bg-rose-500/10">
          <CardContent className="pt-6 text-rose-100">
            Failed to load AI Report. Make sure backend is running and you are logged in.
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.metrics.winRate.toFixed(1)}%</div>
                <p className="mt-1 text-xs text-muted-foreground">Across {report.metrics.totalTrades} closed trades</p>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.metrics.profitFactor.toFixed(2)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Risk-reward {report.metrics.riskReward.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${report.metrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {money.format(report.metrics.totalPnL)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expectancy {money.format(report.deepResearch.summary.expectancyPerTrade)} per trade
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Account Equity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{money.format(wiredTotalEquity)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {wiredConnectedAccounts}/{wiredAccounts.length} connected • Balance {money.format(wiredTotalBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="briefing" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="briefing">AI Briefing</TabsTrigger>
              <TabsTrigger value="execution">Execution Plan</TabsTrigger>
              <TabsTrigger value="deep-research">Deep Research</TabsTrigger>
              <TabsTrigger value="journal">Journal Wire</TabsTrigger>
              <TabsTrigger value="accounts">Accounts Wire</TabsTrigger>
            </TabsList>

            <TabsContent value="briefing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BrainCircuit className="h-5 w-5 text-cyan-300" />
                    AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">{report.ai.summary}</p>
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-emerald-300">Strengths</h3>
                      <div className="flex flex-wrap gap-2">
                        {strengths.length > 0 ? strengths.map((line) => (
                          <Badge key={line} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                            {line}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">No explicit strengths flagged yet.</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-rose-300">Weaknesses</h3>
                      <div className="flex flex-wrap gap-2">
                        {weaknesses.length > 0 ? weaknesses.map((line) => (
                          <Badge key={line} variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-200">
                            {line}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">No major weaknesses currently flagged.</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlert className="h-4 w-4 text-amber-300" />
                      Behavioral Risk Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.deepResearch.behaviorAnalysis.riskFlags.length > 0 ? (
                      report.deepResearch.behaviorAnalysis.riskFlags.map((flag) => (
                        <div key={flag} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                          {flag}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No material risk flags detected in current sample.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-indigo-300" />
                      AI Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiActions.length > 0 ? (
                      aiActions.slice(0, 8).map((line) => (
                        <div key={line} className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100">
                          {line}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">AI assistant returned no extra actions beyond rule engine.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Crunching Numbers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiCrunching.length > 0 ? aiCrunching.map((line) => (
                      <div key={line} className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No AI crunching summary available.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Finding Blindspots</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiBlindspots.length > 0 ? aiBlindspots.map((line) => (
                      <div key={line} className="rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-sm text-sky-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No blindspot notes available.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Identifying Mistakes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiMistakes.length > 0 ? aiMistakes.map((line) => (
                      <div key={line} className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No AI mistake notes available.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Building Action Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiPlan.length > 0 ? aiPlan.map((line) => (
                      <div key={line} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No AI plan notes available.</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="execution" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-cyan-300" />
                    Priority Execution Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.fallbackActions.map((action) => (
                    <div key={`${action.task}-${action.target}`} className="rounded-xl border border-border/60 bg-card/70 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{action.task}</h3>
                        <Badge className={`${priorityClass(action.priority)} border`}>{action.priority.toUpperCase()}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{action.reason}</p>
                      {action.evidence && (
                        <p className="mt-2 text-xs text-muted-foreground">Evidence: {toLabel(action.evidence)}</p>
                      )}
                      <p className="mt-2 text-xs text-cyan-200">Target: {action.target}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deep-research" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Time Intelligence</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Best Hour</p>
                        <p className="font-medium">{report.deepResearch.timeAnalysis.bestHour?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{money.format(report.deepResearch.timeAnalysis.bestHour?.pnl || 0)}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Worst Hour</p>
                        <p className="font-medium">{report.deepResearch.timeAnalysis.worstHour?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{money.format(report.deepResearch.timeAnalysis.worstHour?.pnl || 0)}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Best Weekday</p>
                        <p className="font-medium">{report.deepResearch.timeAnalysis.bestWeekday?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{money.format(report.deepResearch.timeAnalysis.bestWeekday?.pnl || 0)}</p>
                      </div>
                      <div className="rounded-md border border-border/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Worst Weekday</p>
                        <p className="font-medium">{report.deepResearch.timeAnalysis.worstWeekday?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{money.format(report.deepResearch.timeAnalysis.worstWeekday?.pnl || 0)}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      <p>Active days: {report.deepResearch.timeAnalysis.activeDays}</p>
                      <p>Active trading hours: {report.deepResearch.timeAnalysis.activeTradingHours}</p>
                      <p>Trades per active day: {report.deepResearch.timeAnalysis.tradesPerActiveDay.toFixed(2)}</p>
                      <p>Trades per active hour: {report.deepResearch.timeAnalysis.tradesPerActiveHour.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quality Signals</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Average Win</p>
                      <p className="font-medium text-emerald-300">{money.format(report.deepResearch.qualitySignals.averageWin)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Average Loss</p>
                      <p className="font-medium text-rose-300">{money.format(report.deepResearch.qualitySignals.averageLoss)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Payoff Ratio</p>
                      <p className="font-medium">{report.deepResearch.qualitySignals.payoffRatio.toFixed(2)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">PnL Volatility (StdDev)</p>
                      <p className="font-medium">{report.deepResearch.qualitySignals.pnlStdDev.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deep Asset Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepAssetInsights.length > 0 ? deepAssetInsights.map((line) => (
                      <div key={line} className="rounded-md border border-indigo-500/25 bg-indigo-500/5 px-3 py-2 text-sm text-indigo-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No asset insights returned.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deep Timing Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepTimingInsights.length > 0 ? deepTimingInsights.map((line) => (
                      <div key={line} className="rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No timing insights returned.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deep Behavioral Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepBehaviorInsights.length > 0 ? deepBehaviorInsights.map((line) => (
                      <div key={line} className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No behavioral insights returned.</p>}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deep Risk Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepRiskInsights.length > 0 ? deepRiskInsights.map((line) => (
                      <div key={line} className="rounded-md border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-sm text-rose-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No extra risk insights returned.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">AI Deep Execution Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepExecutionPlan.length > 0 ? deepExecutionPlan.map((line) => (
                      <div key={line} className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100">
                        {line}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No deep execution plan returned.</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="journal" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Symbols</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.journalSnapshot.topSymbols.map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Setups</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.journalSnapshot.topSetups.map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Journal Quality</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Total closed trades: {report.journalSnapshot.totalClosedTrades}</p>
                    <p>Avg hold time: {report.metrics.avgHoldTime.toFixed(2)} hours</p>
                    <p>Max losing streak: {report.patterns.losingStreaks.maxLosingStreak}</p>
                    <p>Overtrading: {report.patterns.overtrading.isOvertrading ? 'Yes' : 'No'}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Journal Trades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.journalSnapshot.recentTrades.length === 0 && (
                    <p className="text-sm text-muted-foreground">No closed trades available yet.</p>
                  )}
                  {report.journalSnapshot.recentTrades.map((trade) => (
                    <div key={trade.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 md:grid-cols-[140px_1fr_140px_160px]">
                      <div className="text-sm font-medium">{trade.symbol}</div>
                      <div className="text-sm text-muted-foreground">{trade.setup || 'Unlabeled setup'}</div>
                      <div className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {money.format(trade.pnl)}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(trade.closedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="accounts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-cyan-300" />
                    Account Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {wiredAccounts.map((account) => (
                    <div key={account.id} className="rounded-xl border border-border/60 bg-card/70 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">{account.name}</h3>
                          <p className="text-xs text-muted-foreground">{account.broker || 'Broker N/A'} • {account.accountType}</p>
                        </div>
                        <Badge
                          className={
                            account.status === 'CONNECTED'
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-500/40 bg-slate-500/10 text-slate-300'
                          }
                        >
                          {account.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Balance</span>
                          <span className="font-medium text-foreground">{money.format(account.balance)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Equity</span>
                          <span className="font-medium text-foreground">{money.format(account.equity)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Closed trades</span>
                          <span className="font-medium text-foreground">{account.closedTradeCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>AI PnL (closed)</span>
                          <span className={`font-medium ${account.aiTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {money.format(account.aiTotalPnl)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Session Edge</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {report.deepResearch.sessionAnalysis.sessions.map((session) => (
                      <div key={session.name} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                        <div>
                          <p className="font-medium">{session.name}</p>
                          <p className="text-xs text-muted-foreground">{session.count} trades • {session.winRate.toFixed(1)}% WR</p>
                        </div>
                        <p className={session.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money.format(session.pnl)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Asset Concentration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-muted-foreground">Top-symbol concentration</p>
                      <p className="text-xl font-semibold">
                        {report.deepResearch.assetAnalysis.concentrationPct.toFixed(1)}%
                      </p>
                    </div>
                    {report.deepResearch.assetAnalysis.assets.slice(0, 5).map((asset) => (
                      <div key={asset.name} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.count} trades • PF {asset.profitFactor.toFixed(2)}</p>
                        </div>
                        <p className={asset.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money.format(asset.pnl)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Consistency score: {report.deepResearch.summary.consistencyScore.toFixed(1)} / 100
            </span>
            <span>Generated at {new Date(report.generatedAt).toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
