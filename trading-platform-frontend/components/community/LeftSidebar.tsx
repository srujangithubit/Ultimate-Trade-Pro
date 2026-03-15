'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  TrendingUp,
  Clock,
  Bookmark,
  Heart,
  Users,
  Filter,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const POPULAR_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD',
  'GBPJPY', 'AUDUSD', 'NAS100', 'US30', 'SPX500',
];

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

interface LeftSidebarProps {
  onFilterChange: (symbol: string | null) => void;
}

export default function LeftSidebar({ onFilterChange }: LeftSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  const handleSymbolClick = (symbol: string) => {
    if (activeSymbol === symbol) {
      setActiveSymbol(null);
      onFilterChange(null);
    } else {
      setActiveSymbol(symbol);
      onFilterChange(symbol);
    }
  };

  const filteredSymbols = POPULAR_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbols..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Active Filter */}
      {activeSymbol && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeSymbol}
            <button onClick={() => handleSymbolClick(activeSymbol)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Quick Links */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Quick Links
        </p>
        {[
          { icon: Clock, label: 'Latest Posts' },
          { icon: TrendingUp, label: 'Trending' },
          { icon: Heart, label: 'Most Liked' },
          { icon: Bookmark, label: 'Saved Posts' },
          { icon: Users, label: 'Following' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </button>
        ))}
      </div>

      <Separator />

      {/* Popular Symbols */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Popular Symbols
        </p>
        <div className="flex flex-wrap gap-1.5">
          {filteredSymbols.map((symbol) => (
            <motion.button
              key={symbol}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSymbolClick(symbol)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeSymbol === symbol
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {symbol}
            </motion.button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Timeframes */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Timeframes
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TIMEFRAMES.map((tf) => (
            <Badge key={tf} variant="outline" className="cursor-pointer text-xs">
              {tf}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
