'use client';

import { useState } from 'react';
import { MonitorSmartphone, BarChart3, Activity, Zap, Signal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MT5Dashboard from '@/components/mt5/MT5Dashboard';
import { useMT5 } from '@/components/mt5/MT5Context';

export default function AccountsPage() {
    const [activeTab, setActiveTab] = useState<'trading' | 'analytics'>('trading');
    const { status } = useMT5();

    const tabs = [
        { key: 'trading' as const, label: 'Trading', icon: Activity, description: 'Live positions & history' },
        { key: 'analytics' as const, label: 'Analytics', icon: BarChart3, description: 'Performance insights' },
    ];

    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            {/* Enhanced Header */}
            <div className="relative overflow-hidden rounded-xl border bg-linear-to-br from-card via-card to-card p-6">
                {/* Subtle animated background gradient */}
                <div className="absolute inset-0 bg-linear-to-r from-blue-500/3 via-purple-500/3 to-emerald-500/3" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-blue-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
                
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <motion.div 
                        className="flex items-center gap-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        {/* Animated icon container */}
                        <div className="relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/15 to-purple-500/15 border border-blue-500/10">
                                <MonitorSmartphone className="h-6 w-6 text-blue-500" />
                            </div>
                            {/* Live pulse indicator */}
                            {status.authenticated && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-card" />
                                </span>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl font-bold tracking-tight">Live Trading</h1>
                                {status.authenticated && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5"
                                    >
                                        <Signal className="h-3 w-3 text-green-500" />
                                        <span className="text-[11px] font-medium text-green-600 dark:text-green-400">Live</span>
                                    </motion.div>
                                )}
                            </div>
                            <p className="text-muted-foreground text-sm mt-0.5">
                                Connect to your MT5 accounts for real-time data and trade management
                            </p>
                        </div>
                    </motion.div>

                    {/* Enhanced Tab Switcher with sliding indicator */}
                    <motion.div 
                        className="relative flex items-center rounded-xl border bg-muted/40 backdrop-blur-sm p-1 gap-1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 z-10 ${
                                    activeTab === tab.key
                                        ? 'text-foreground'
                                        : 'text-muted-foreground hover:text-foreground/80'
                                }`}
                            >
                                {activeTab === tab.key && (
                                    <motion.div
                                        layoutId="activeTabBg"
                                        className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                                    />
                                )}
                                <tab.icon className="h-4 w-4 relative z-10" />
                                <span className="relative z-10">{tab.label}</span>
                            </button>
                        ))}
                    </motion.div>
                </div>

                {/* Quick stats bar when connected */}
                <AnimatePresence>
                    {status.authenticated && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.3 }}
                            className="relative flex items-center gap-6 border-t border-border/50 pt-4 overflow-hidden"
                        >
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Zap className="h-3 w-3 text-yellow-500" />
                                <span>Real-time sync active</span>
                            </div>
                            <div className="h-3 w-px bg-border/60" />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span>WebSocket connected</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* MT5 Dashboard with active tab - wrapped in AnimatePresence for tab transitions */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                    <MT5Dashboard activeTab={activeTab} />
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
