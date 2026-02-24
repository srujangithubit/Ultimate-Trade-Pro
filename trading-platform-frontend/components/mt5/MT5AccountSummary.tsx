/**
 * MT5AccountSummary - Displays live MT5 account metrics using shadcn/ui Cards.
 */

'use client';

import React, { useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Shield,
  Wallet,
  Landmark,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useMT5 } from './MT5Context';

export default function MT5AccountSummary() {
  const { account, refreshAccount, status } = useMT5();

  useEffect(() => {
    if (status.authenticated) {
      refreshAccount();
      const interval = setInterval(refreshAccount, 10000);
      return () => clearInterval(interval);
    }
  }, [status.authenticated, refreshAccount]);

  if (!status.authenticated || !account) {
    return null;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);

  const marginLevel =
    account.margin > 0
      ? ((account.equity / account.margin) * 100).toFixed(1)
      : '∞';

  const metrics = [
    {
      label: 'Balance',
      value: formatCurrency(account.balance),
      icon: DollarSign,
      color: 'bg-blue-500/10 text-blue-500',
      gradient: 'from-blue-500/5 to-blue-600/5',
      borderHover: 'hover:border-blue-500/20',
    },
    {
      label: 'Equity',
      value: formatCurrency(account.equity),
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-500',
      gradient: 'from-emerald-500/5 to-green-600/5',
      borderHover: 'hover:border-emerald-500/20',
    },
    {
      label: 'Margin',
      value: formatCurrency(account.margin),
      icon: Shield,
      color: 'bg-orange-500/10 text-orange-500',
      gradient: 'from-orange-500/5 to-amber-600/5',
      borderHover: 'hover:border-orange-500/20',
    },
    {
      label: 'Free Margin',
      value: formatCurrency(account.free_margin),
      icon: Wallet,
      color: 'bg-purple-500/10 text-purple-500',
      gradient: 'from-purple-500/5 to-violet-600/5',
      borderHover: 'hover:border-purple-500/20',
    },
    {
      label: 'Leverage',
      value: `1:${account.leverage}`,
      icon: Landmark,
      color: 'bg-sky-500/10 text-sky-500',
      gradient: 'from-sky-500/5 to-cyan-600/5',
      borderHover: 'hover:border-sky-500/20',
    },
    {
      label: 'Margin Level',
      value: `${marginLevel}%`,
      icon: BarChart3,
      color: 'bg-amber-500/10 text-amber-500',
      gradient: 'from-amber-500/5 to-yellow-600/5',
      borderHover: 'hover:border-amber-500/20',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-linear-to-b from-emerald-500 to-green-600" />
          <h3 className="text-sm font-medium text-muted-foreground">
            {account.name} — {account.server} (#{account.login})
          </h3>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, index) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <Card className={`p-3 transition-all duration-200 bg-linear-to-br ${m.gradient} ${m.borderHover} cursor-default`}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.color}`}
                >
                  <m.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-none truncate">
                    {m.label}
                  </p>
                  <p className="text-sm font-semibold leading-tight mt-0.5 truncate">
                    {m.value}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
