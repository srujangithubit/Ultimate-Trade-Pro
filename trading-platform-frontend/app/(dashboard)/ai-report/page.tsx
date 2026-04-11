'use client';

import { useMemo, useState } from 'react';
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
import { api } from '@/lib/api/client';
import { BacktestSession } from '@/lib/types/backtesting';

const BACKTEST_BASES = ['/backtesting', '/api/backtesting'];

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
  const [sessionId, setSessionId] = useState<string>('ALL');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'ai-report-filter'],
    queryFn: () => accountsApi.getAll(),
  });

  const { data: sessions = [] } = useQuery({
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

  const reportQuery = useQuery({
    queryKey: ['ai-report', accountId, sessionId],
    queryFn: () =>
      aiReportApi.getReport({
        accountId: accountId === 'ALL' ? undefined : accountId,
        sessionId: sessionId === 'ALL' ? undefined : sessionId,
      }),
  });

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
                  <SelectValue placeholder="Filter backtest session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Backtest Sessions</SelectItem>
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
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => reportQuery.refetch()}
                className="border-white/20 bg-black/20 text-white hover:bg-black/35"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
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
                <div className="text-2xl font-bold">{money.format(report.accountsSnapshot.totalEquity)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.accountsSnapshot.connectedAccounts}/{report.accountsSnapshot.totalAccounts} connected
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="briefing" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="briefing">AI Briefing</TabsTrigger>
              <TabsTrigger value="execution">Execution Plan</TabsTrigger>
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
                      <p className="mt-2 text-xs text-cyan-200">Target: {action.target}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                  {report.accountsSnapshot.accounts.map((account) => (
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
                          <span>Account PnL</span>
                          <span className={`font-medium ${account.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {money.format(account.totalPnl)}
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
