'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { GroupPerformance } from '@/types/trade-sync';

interface PerformanceComparisonProps {
  performance: GroupPerformance | null;
}

const COLORS = [
  'hsl(var(--primary))',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
];

export default function PerformanceComparison({
  performance,
}: PerformanceComparisonProps) {
  if (!performance) return null;

  // Build combined dataset
  const masterCurve = performance.masterEquityCurve ?? [];
  const slaveCurves = performance.slaveEquityCurves ?? [];

  // Get all timestamps
  const allTimes = new Set<string>();
  masterCurve.forEach((p) => allTimes.add(p.time));
  slaveCurves.forEach((sc) =>
    sc.curve.forEach((p) => allTimes.add(p.time)),
  );

  const sortedTimes = Array.from(allTimes).sort();

  const data = sortedTimes.map((time) => {
    const point: Record<string, number | string> = {
      time: new Date(time).toLocaleTimeString(),
    };

    const masterPoint = masterCurve.find((p) => p.time === time);
    if (masterPoint) {
      point['Master'] = masterPoint.equity;
    }

    slaveCurves.forEach((sc) => {
      const slavePoint = sc.curve.find((p) => p.time === time);
      if (slavePoint) {
        point[sc.slaveName] = slavePoint.equity;
      }
    });

    return point;
  });

  const lines = ['Master', ...slaveCurves.map((sc) => sc.slaveName)];

  const stats = performance.replicationStats;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Performance Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
            <div className="text-xs text-muted-foreground">Total Trades</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-green-500">
              {stats.filled}
            </div>
            <div className="text-xs text-muted-foreground">Filled</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-orange-500">
              {stats.rejected}
            </div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">
              {stats.successRate}%
            </div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{stats.avgLatencyMs}ms</div>
            <div className="text-xs text-muted-foreground">Avg Latency</div>
          </div>
        </div>

        {/* Equity Chart */}
        {data.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  formatter={(value?: number | string) =>
                    `$${Number(value ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
                <Legend />
                {lines.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={name === 'Master' ? 2.5 : 1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No equity data available yet. Connect your accounts to start
            tracking.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
