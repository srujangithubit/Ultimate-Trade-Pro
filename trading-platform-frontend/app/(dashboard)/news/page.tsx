'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Filter,
  ChevronRight,
  Globe,
  AlertTriangle,
  Flame,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;       // ISO datetime
  impact: 'high' | 'medium' | 'low';
  category: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  unit: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/*  Currency → Country mapping for Forex Factory data                   */
/* ------------------------------------------------------------------ */

const CURRENCY_MAP: Record<string, { country: string; code: string }> = {
  USD: { country: 'United States', code: 'US' },
  EUR: { country: 'Eurozone', code: 'EU' },
  GBP: { country: 'United Kingdom', code: 'GB' },
  JPY: { country: 'Japan', code: 'JP' },
  AUD: { country: 'Australia', code: 'AU' },
  NZD: { country: 'New Zealand', code: 'NZ' },
  CAD: { country: 'Canada', code: 'CA' },
  CHF: { country: 'Switzerland', code: 'CH' },
  CNY: { country: 'China', code: 'CN' },
};

/*  Category detection from event title                                */
/* ------------------------------------------------------------------ */

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('cpi') || t.includes('ppi') || t.includes('inflation') || t.includes('pce')) return 'Inflation';
  if (t.includes('gdp')) return 'GDP';
  if (t.includes('employment') || t.includes('payroll') || t.includes('unemployment') || t.includes('claims') || t.includes('jobs') || t.includes('adp')) return 'Employment';
  if (t.includes('rate') && (t.includes('interest') || t.includes('loan') || t.includes('prime'))) return 'Central Bank';
  if (t.includes('speaks') || t.includes('speech') || t.includes('hearings') || t.includes('president') || t.includes('governor') || t.includes('member') || t.includes('chairman')) return 'Speech';
  if (t.includes('pmi') || t.includes('manufacturing') || t.includes('industrial') || t.includes('factory')) return 'Manufacturing';
  if (t.includes('retail') || t.includes('consumer') || t.includes('confidence') || t.includes('spending') || t.includes('sales')) return 'Consumer';
  if (t.includes('trade') || t.includes('export') || t.includes('import') || t.includes('current account') || t.includes('balance')) return 'Trade';
  if (t.includes('housing') || t.includes('building') || t.includes('construction') || t.includes('home') || t.includes('hpi')) return 'Housing';
  if (t.includes('oil') || t.includes('gas') || t.includes('energy')) return 'Energy';
  if (t.includes('bond') || t.includes('auction') || t.includes('treasury')) return 'Bond';
  if (t.includes('holiday')) return 'Holiday';
  return 'Economic';
}

/*  Forex Factory JSON → EconomicEvent mapper                          */
/* ------------------------------------------------------------------ */

interface FFEvent {
  title: string;
  country: string;   // currency code e.g. "USD"
  date: string;      // ISO with timezone e.g. "2026-02-27T08:30:00-05:00"
  impact: string;    // "High", "Medium", "Low", "Holiday", "Non-Economic"
  forecast: string;
  previous: string;
  actual?: string;   // present when data is released
}

/*  Descriptions for well-known events                                 */
/* ------------------------------------------------------------------ */

const EVENT_DESCRIPTIONS: Record<string, string> = {
  'non-farm payrolls': 'Change in the number of employed people, excluding the farming industry. Released first Friday of each month.',
  'unemployment claims': 'Weekly count of initial jobless claims filed by individuals seeking unemployment benefits.',
  'unemployment rate': 'Percentage of the total workforce that is unemployed and actively seeking employment.',
  'cpi m/m': 'Consumer Price Index — monthly change in the price of goods and services purchased by consumers.',
  'cpi y/y': 'Consumer Price Index — annual change in consumer prices, a key measure of inflation.',
  'core cpi y/y': 'CPI excluding food and energy — considered a more stable measure of underlying inflation.',
  'core cpi m/m': 'Monthly core CPI excluding volatile food and energy components.',
  'final core cpi y/y': 'Final release of the annual core Consumer Price Index.',
  'final cpi y/y': 'Final release of the annual Consumer Price Index.',
  'ppi m/m': 'Producer Price Index — monthly change in prices charged by domestic producers.',
  'core ppi m/m': 'Producer Price Index excluding food and energy — monthly change.',
  'gdp q/q': 'Gross Domestic Product — quarterly growth rate of the economy.',
  'gdp m/m': 'Monthly GDP growth — measures economic output on a monthly basis.',
  'german final gdp q/q': 'Final release of Germany\'s quarterly GDP growth rate.',
  'french prelim gdp q/q': 'Preliminary release of France\'s quarterly GDP growth.',
  'interest rate decision': 'Central bank decision on the benchmark interest rate.',
  'retail sales m/m': 'Monthly change in the total value of sales at the retail level.',
  'cb consumer confidence': 'Conference Board survey measuring consumer confidence in economic conditions.',
  'consumer confidence': 'Survey measuring consumer optimism about the economy.',
  'crude oil inventories': 'Weekly change in crude oil inventories held by US commercial firms.',
  'natural gas storage': 'Weekly change in natural gas held in underground storage.',
  'trade balance': 'Difference between exported and imported goods and services.',
  'building permits': 'Number of new residential building permits issued.',
  'president trump speaks': 'Presidential address — markets watch for policy signals on trade, tariffs, and economic agenda.',
  'ecb president lagarde speaks': 'ECB President speech — watched for monetary policy signals in the Eurozone.',
  'fomc member waller speaks': 'Federal Reserve Governor speech — provides insight into monetary policy views.',
  'fomc member bostic speaks': 'Atlanta Fed President speech on economic outlook and policy.',
  'fomc member goolsbee speaks': 'Chicago Fed President speech on economic conditions.',
  'fomc member cook speaks': 'Federal Reserve Governor speech on monetary policy.',
  'fomc member collins speaks': 'Boston Fed President views on the economy and rates.',
  'fomc member barkin speaks': 'Richmond Fed President commentary on economic outlook.',
  'fomc member bowman speaks': 'Federal Reserve Governor views on banking and monetary policy.',
  'fomc member schmid speaks': 'Kansas City Fed President views on the economy.',
  'fomc member musalem speaks': 'St. Louis Fed President economic commentary.',
  'snb chairman schlegel speaks': 'Swiss National Bank Chairman speech on monetary policy.',
  'rba gov bullock speaks': 'Reserve Bank of Australia Governor on monetary policy outlook.',
  'mpc member taylor speaks': 'Bank of England Monetary Policy Committee member speech.',
  'mpc member lombardelli speaks': 'Bank of England MPC member views on monetary policy.',
  'mpc member pill speaks': 'Bank of England Chief Economist views on inflation and rates.',
  'monetary policy report hearings': 'Bank of England officials testify before Parliament on monetary policy.',
  'german ifo business climate': 'Leading German business sentiment indicator based on ~9,000 firm survey responses.',
  'german gfk consumer climate': 'Forward-looking German consumer confidence indicator.',
  'richmond manufacturing index': 'Regional manufacturing activity index from the Federal Reserve Bank of Richmond.',
  'pmi manufacturing': 'Purchasing Managers Index for the manufacturing sector — above 50 signals expansion.',
  'chicago pmi': 'Chicago-area business barometer measuring manufacturing and non-manufacturing activity.',
  'factory orders m/m': 'Monthly change in the total value of new purchase orders to manufacturers.',
  'trimmed mean cpi m/m': 'Trimmed mean CPI — removes extreme price changes for a clearer inflation signal.',
  'tokyo core cpi y/y': 'Leading indicator of nationwide Japanese inflation — released a month ahead.',
  'german prelim cpi m/m': 'Preliminary monthly German CPI — earliest Eurozone inflation signal.',
  'french prelim cpi m/m': 'Preliminary monthly French consumer price index.',
  'spanish flash cpi y/y': 'Flash estimate of Spanish annual inflation.',
  'german unemployment change': 'Monthly change in the number of unemployed people in Germany.',
  'kof economic barometer': 'Swiss leading economic indicator forecasting GDP growth.',
  'adp weekly employment change': 'ADP estimate of weekly private non-farm employment changes.',
  'construction spending m/m': 'Monthly change in total construction spending.',
  '1-y loan prime rate': 'People\'s Bank of China one-year Loan Prime Rate — key lending benchmark.',
  '5-y loan prime rate': 'People\'s Bank of China five-year LPR — influences mortgage rates.',
};

function getEventDescription(title: string): string {
  const key = title.toLowerCase().trim();
  if (EVENT_DESCRIPTIONS[key]) return EVENT_DESCRIPTIONS[key];
  // Try partial match
  for (const [k, v] of Object.entries(EVENT_DESCRIPTIONS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return '';
}

function mapFFEvents(raw: FFEvent[]): EconomicEvent[] {
  return raw
    .filter((e) => e.impact !== 'Holiday' && e.impact !== 'Non-Economic')
    .map((e, i) => {
      const mapped = CURRENCY_MAP[e.country] || { country: e.country, code: e.country };
      return {
        id: `ff-${i}`,
        title: e.title,
        country: mapped.country,
        countryCode: mapped.code,
        date: e.date,  // Preserve exact ISO date+timezone from FF
        impact: (e.impact?.toLowerCase() === 'high' ? 'high' : e.impact?.toLowerCase() === 'medium' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        category: detectCategory(e.title),
        forecast: e.forecast || null,
        previous: e.previous || null,
        actual: e.actual || null,
        unit: '',
        description: getEventDescription(e.title),
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Fallback mock data — only used when FF API is unreachable          */
/* ------------------------------------------------------------------ */

function generateMockNews(): EconomicEvent[] {
  // Fixed, realistic scheduled release times for economic events
  const events: Omit<EconomicEvent, 'id'>[] = [
    {
      title: 'Non-Farm Payrolls',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-06T08:30:00-05:00',  // 8:30 AM ET — first Friday of month
      impact: 'high',
      category: 'Employment',
      forecast: '185K',
      previous: '175K',
      actual: '199K',
      unit: '',
      description: 'Change in the number of employed people during the previous month, excluding the farming industry.',
    },
    {
      title: 'CPI (YoY)',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-12T08:30:00-05:00',  // 8:30 AM ET
      impact: 'high',
      category: 'Inflation',
      forecast: '3.1%',
      previous: '3.2%',
      actual: '2.9%',
      unit: '',
      description: 'Consumer Price Index measures the change in the price of goods and services.',
    },
    {
      title: 'Interest Rate Decision',
      country: 'Eurozone',
      countryCode: 'EU',
      date: '2026-02-20T13:45:00+01:00',  // 1:45 PM CET
      impact: 'high',
      category: 'Central Bank',
      forecast: '4.25%',
      previous: '4.50%',
      actual: '4.25%',
      unit: '',
      description: 'ECB main refinancing operations interest rate decision.',
    },
    {
      title: 'GDP (QoQ)',
      country: 'United Kingdom',
      countryCode: 'GB',
      date: '2026-02-13T07:00:00+00:00',  // 7:00 AM GMT
      impact: 'high',
      category: 'GDP',
      forecast: '0.3%',
      previous: '0.1%',
      actual: '0.4%',
      unit: '',
      description: 'Gross Domestic Product quarterly growth rate.',
    },
    {
      title: 'Retail Sales (MoM)',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-14T08:30:00-05:00',  // 8:30 AM ET
      impact: 'medium',
      category: 'Consumer',
      forecast: '0.4%',
      previous: '0.6%',
      actual: '0.3%',
      unit: '',
      description: 'Change in the total value of sales at the retail level.',
    },
    {
      title: 'Unemployment Rate',
      country: 'Japan',
      countryCode: 'JP',
      date: '2026-02-24T08:30:00+09:00',  // 8:30 AM JST
      impact: 'medium',
      category: 'Employment',
      forecast: '2.5%',
      previous: '2.4%',
      actual: '2.5%',
      unit: '',
      description: 'Percentage of the total workforce that is unemployed.',
    },
    {
      title: 'PMI Manufacturing',
      country: 'Germany',
      countryCode: 'DE',
      date: '2026-02-25T09:30:00+01:00',  // 9:30 AM CET — upcoming
      impact: 'medium',
      category: 'Manufacturing',
      forecast: '43.5',
      previous: '42.6',
      actual: null,
      unit: '',
      description: 'Purchasing Managers Index for the manufacturing sector.',
    },
    {
      title: 'Trade Balance',
      country: 'China',
      countryCode: 'CN',
      date: '2026-02-10T10:00:00+08:00',  // 10:00 AM CST
      impact: 'medium',
      category: 'Trade',
      forecast: '$85.2B',
      previous: '$78.4B',
      actual: '$90.1B',
      unit: '',
      description: 'Difference in value between imported and exported goods.',
    },
    {
      title: 'Consumer Confidence',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-25T10:00:00-05:00',  // 10:00 AM ET — upcoming
      impact: 'medium',
      category: 'Consumer',
      forecast: '104.5',
      previous: '102.0',
      actual: null,
      unit: '',
      description: 'Level of consumer confidence in economic activity.',
    },
    {
      title: 'BOJ Interest Rate Decision',
      country: 'Japan',
      countryCode: 'JP',
      date: '2026-02-27T12:00:00+09:00',  // 12:00 PM JST — upcoming
      impact: 'high',
      category: 'Central Bank',
      forecast: '0.25%',
      previous: '0.10%',
      actual: null,
      unit: '',
      description: 'Bank of Japan interest rate decision.',
    },
    {
      title: 'Building Permits',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-19T08:30:00-05:00',  // 8:30 AM ET
      impact: 'low',
      category: 'Housing',
      forecast: '1.46M',
      previous: '1.44M',
      actual: '1.49M',
      unit: '',
      description: 'Number of new residential building permits issued.',
    },
    {
      title: 'Industrial Production (MoM)',
      country: 'Eurozone',
      countryCode: 'EU',
      date: '2026-02-18T10:00:00+01:00',  // 10:00 AM CET
      impact: 'low',
      category: 'Manufacturing',
      forecast: '-0.1%',
      previous: '0.5%',
      actual: '-0.3%',
      unit: '',
      description: 'Change in the total inflation-adjusted value of output produced.',
    },
    {
      title: 'Core PCE Price Index (MoM)',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-28T08:30:00-05:00',  // 8:30 AM ET — upcoming
      impact: 'high',
      category: 'Inflation',
      forecast: '0.2%',
      previous: '0.3%',
      actual: null,
      unit: '',
      description: "The Fed's preferred inflation measure. Core PCE excludes food and energy.",
    },
    {
      title: 'RBA Interest Rate Decision',
      country: 'Australia',
      countryCode: 'AU',
      date: '2026-03-03T14:30:00+11:00',  // 2:30 PM AEDT — upcoming
      impact: 'high',
      category: 'Central Bank',
      forecast: '4.10%',
      previous: '4.35%',
      actual: null,
      unit: '',
      description: 'Reserve Bank of Australia cash rate target decision.',
    },
    {
      title: 'Crude Oil Inventories',
      country: 'United States',
      countryCode: 'US',
      date: '2026-02-18T10:30:00-05:00',  // 10:30 AM ET — every Wednesday
      impact: 'medium',
      category: 'Energy',
      forecast: '-1.2M',
      previous: '2.1M',
      actual: '-3.4M',
      unit: '',
      description: 'Weekly change in crude oil inventories held by US firms.',
    },
  ];

  return events.map((e, i) => ({ ...e, id: `mock-${i}` }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳',
    DE: '🇩🇪', AU: '🇦🇺', CA: '🇨🇦', CH: '🇨🇭', NZ: '🇳🇿',
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CNY: '🇨🇳',
    AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿',
  };
  return flags[code] || '🌐';
}

function getImpactConfig(impact: string) {
  switch (impact) {
    case 'high':
      return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'High Impact', icon: Flame };
    case 'medium':
      return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Medium Impact', icon: AlertTriangle };
    default:
      return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Low Impact', icon: BarChart3 };
  }
}

function getDeviationInfo(actual: string | null, forecast: string | null) {
  if (!actual || !forecast) return null;
  const a = parseFloat(actual.replace(/[^0-9.\-]/g, ''));
  const f = parseFloat(forecast.replace(/[^0-9.\-]/g, ''));
  if (isNaN(a) || isNaN(f)) return null;
  const diff = a - f;
  if (Math.abs(diff) < 0.001) return { direction: 'neutral' as const, diff: 0 };
  return { direction: diff > 0 ? ('up' as const) : ('down' as const), diff };
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  if (absDiff < 30 * 1000) return 'Just now';
  if (absDiff < 60 * 1000) {
    const secs = Math.floor(absDiff / 1000);
    return isFuture ? `In ${secs}s` : `${secs}s ago`;
  }
  if (absDiff < 60 * 60 * 1000) {
    const mins = Math.floor(absDiff / (60 * 1000));
    return isFuture ? `In ${mins}m` : `${mins}m ago`;
  }
  if (absDiff < 24 * 60 * 60 * 1000) {
    const hrs = Math.floor(absDiff / (60 * 60 * 1000));
    const mins = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));
    const label = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    return isFuture ? `In ${label}` : `${label} ago`;
  }
  const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
  const hrs = Math.floor((absDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const label = hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  return isFuture ? `In ${label}` : `${label} ago`;
}

function formatEventTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewsPage() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [impactFilter, setImpactFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // Forces re-render for live relative times

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch via our Next.js API proxy to avoid CORS issues
      // The proxy fetches both this-week and next-week FF data
      const res = await fetch('/api/news', { cache: 'no-store' });
      if (!res.ok) throw new Error('API error');
      const raw: FFEvent[] = await res.json();
      // Ensure it's an array (not an error object)
      if (!Array.isArray(raw)) throw new Error('Invalid data');
      const mapped = mapFFEvents(raw);
      setEvents(mapped.length > 0 ? mapped : generateMockNews());
      setLastUpdated(new Date());
    } catch {
      // Fallback to mock data if API is unreachable
      setEvents(generateMockNews());
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    // Auto-refresh data every 5 minutes
    const dataTimer = setInterval(fetchNews, 5 * 60 * 1000);
    // Update relative times every 30 seconds
    const tickTimer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(dataTimer);
      clearInterval(tickTimer);
    };
  }, [fetchNews]);

  /* --- Derived data --- */
  const countries = useMemo(
    () => [...new Set(events.map((e) => e.country))].sort(),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => {
        // Search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !e.title.toLowerCase().includes(q) &&
            !e.country.toLowerCase().includes(q) &&
            !e.category.toLowerCase().includes(q)
          )
            return false;
        }
        // Impact
        if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
        // Country
        if (countryFilter !== 'all' && e.country !== countryFilter) return false;
        // Time
        if (timeFilter === 'upcoming') return new Date(e.date) > now;
        if (timeFilter === 'past') return new Date(e.date) <= now;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchQuery, impactFilter, countryFilter, timeFilter, tick]);

  /* --- Stats --- */
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: events.length,
      highImpact: events.filter((e) => e.impact === 'high').length,
      upcoming: events.filter((e) => new Date(e.date) > now).length,
      released: events.filter((e) => e.actual !== null).length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            Economic News Calendar
          </h1>
          <p className="text-muted-foreground">
            Live economic calendar from Forex Factory — track market-moving events, forecasts, and releases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {formatRelativeTime(lastUpdated.toISOString())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNews}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { label: 'Total Events', value: stats.total, icon: Calendar, color: 'text-primary' },
          { label: 'High Impact', value: stats.highImpact, icon: Flame, color: 'text-red-500' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-amber-500' },
          { label: 'Released', value: stats.released, icon: BarChart3, color: 'text-emerald-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-accent p-2 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex flex-col sm:flex-row gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={impactFilter} onValueChange={setImpactFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Impact</SelectItem>
            <SelectItem value="high">High Impact</SelectItem>
            <SelectItem value="medium">Medium Impact</SelectItem>
            <SelectItem value="low">Low Impact</SelectItem>
          </SelectContent>
        </Select>

        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[180px]">
            <Globe className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[150px]">
            <Clock className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Released</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* News cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-12 bg-muted rounded" />
                    <div className="h-12 bg-muted rounded" />
                    <div className="h-12 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Newspaper className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm">Try adjusting your filters or search query.</p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEvents.map((event, index) => {
                const impactCfg = getImpactConfig(event.impact);
                const ImpactIcon = impactCfg.icon;
                const deviation = getDeviationInfo(event.actual, event.forecast);
                const isUpcoming = new Date(event.date) > new Date();

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                  >
                    <Card className={`overflow-hidden border-l-4 ${impactCfg.border} hover:shadow-lg transition-shadow`}>
                      <CardContent className="p-0">
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-3 p-4 pb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl" title={event.country}>
                                {getCountryFlag(event.countryCode)}
                              </span>
                              <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatEventTime(event.date)}
                              </span>
                              <span className="text-muted-foreground/50">·</span>
                              <span>{formatRelativeTime(event.date)}</span>
                              <span className="text-muted-foreground/50">·</span>
                              <span>{event.country}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${impactCfg.color} ${impactCfg.bg} border-transparent`}
                            >
                              <ImpactIcon className="h-3 w-3 mr-1" />
                              {impactCfg.label}
                            </Badge>
                            {isUpcoming && (
                              <Badge variant="secondary" className="text-[10px]">
                                Upcoming
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Time + Category */}
                        <div className="px-4 pb-2 space-y-2">
                          {/* Prominent time display */}
                          <div className="flex items-center gap-2 rounded-md bg-accent/60 px-3 py-1.5">
                            <Clock className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">
                                {new Date(event.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <span className="ml-auto text-xs text-muted-foreground font-medium">
                              {formatRelativeTime(event.date)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {event.category}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Forecast / Previous / Actual grid */}
                        <div className="grid grid-cols-3 border-t border-border">
                          {/* Forecast */}
                          <div className="p-3 text-center border-r border-border">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Forecast
                            </p>
                            <p className="text-sm font-semibold">
                              {event.forecast ?? '—'}
                            </p>
                          </div>

                          {/* Previous */}
                          <div className="p-3 text-center border-r border-border">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                              <ChevronRight className="h-3 w-3" />
                              Previous
                            </p>
                            <p className="text-sm font-semibold">
                              {event.previous ?? '—'}
                            </p>
                          </div>

                          {/* Actual */}
                          <div className="p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              Actual
                            </p>
                            {event.actual ? (
                              <div className="flex items-center justify-center gap-1">
                                <p
                                  className={`text-sm font-bold ${
                                    deviation
                                      ? deviation.direction === 'up'
                                        ? 'text-emerald-500'
                                        : deviation.direction === 'down'
                                          ? 'text-red-500'
                                          : ''
                                      : ''
                                  }`}
                                >
                                  {event.actual}
                                </p>
                                {deviation && deviation.direction === 'up' && (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                                {deviation && deviation.direction === 'down' && (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                                )}
                                {deviation && deviation.direction === 'neutral' && (
                                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">Pending</p>
                            )}
                          </div>
                        </div>

                        {/* Deviation bar (if actual released & beats/misses forecast) */}
                        {deviation && deviation.direction !== 'neutral' && (
                          <div className={`px-4 py-2 text-xs flex items-center gap-2 ${
                            deviation.direction === 'up'
                              ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/5 text-red-600 dark:text-red-400'
                          }`}>
                            {deviation.direction === 'up' ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            <span className="font-medium">
                              {deviation.direction === 'up' ? 'Beat' : 'Missed'} forecast by{' '}
                              {Math.abs(deviation.diff).toFixed(2).replace(/\.?0+$/, '')}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
