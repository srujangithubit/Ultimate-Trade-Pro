'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ClipboardCheck,
    ChevronDown,
    ChevronRight,
    BookMarked,
    Target,
    BarChart3,
    Activity,
    Tag,
    Shield,
    TrendingUp,
    Crosshair,
    Layers,
    MapPin,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Circle,
    Loader2,
    RotateCcw,
    ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { playbooksApi, Playbook } from '@/lib/api/playbooks';
import { generateChecklist, GeneratedChecklist } from '@/lib/checklist-generator';

// ── Section icon mapping ──
const SECTION_ICONS: Record<string, React.ElementType> = {
    'Market Context': TrendingUp,
    'Market Structure': Layers,
    'Key Levels': MapPin,
    'Entry Confirmation': Crosshair,
    'Risk Management': Shield,
    'Trade Execution': Zap,
};

const SECTION_COLORS: Record<string, string> = {
    'Market Context': 'text-blue-400',
    'Market Structure': 'text-purple-400',
    'Key Levels': 'text-amber-400',
    'Entry Confirmation': 'text-emerald-400',
    'Risk Management': 'text-red-400',
    'Trade Execution': 'text-cyan-400',
};

const SECTION_BG: Record<string, string> = {
    'Market Context': 'bg-blue-500/10 border-blue-500/20',
    'Market Structure': 'bg-purple-500/10 border-purple-500/20',
    'Key Levels': 'bg-amber-500/10 border-amber-500/20',
    'Entry Confirmation': 'bg-emerald-500/10 border-emerald-500/20',
    'Risk Management': 'bg-red-500/10 border-red-500/20',
    'Trade Execution': 'bg-cyan-500/10 border-cyan-500/20',
};

export default function ChecklistPage() {
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected playbook & generated checklist
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [checklist, setChecklist] = useState<GeneratedChecklist | null>(null);

    // Checkbox state: { [itemId]: boolean }
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    // Collapsed section state
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const fetchPlaybooks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await playbooksApi.getAll();
            setPlaybooks(data);
        } catch (err) {
            console.error('Failed to fetch playbooks:', err);
            setError('Failed to load playbooks. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlaybooks();
    }, [fetchPlaybooks]);

    // Generate checklist when a playbook is selected
    const handleSelectPlaybook = (pb: Playbook) => {
        setSelectedPlaybook(pb);
        const generated = generateChecklist(pb);
        setChecklist(generated);
        setChecked({});
        setCollapsedSections({});
    };

    const handleBack = () => {
        setSelectedPlaybook(null);
        setChecklist(null);
        setChecked({});
        setCollapsedSections({});
    };

    const handleReset = () => {
        setChecked({});
    };

    const toggleCheck = (id: string) => {
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSection = (section: string) => {
        setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Stats
    const stats = useMemo(() => {
        if (!checklist) return { total: 0, completed: 0, percent: 0 };
        const total = checklist.checklist_sections.reduce((sum, s) => sum + s.items.length, 0);
        const completed = Object.values(checked).filter(Boolean).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percent };
    }, [checklist, checked]);

    const allChecked = stats.total > 0 && stats.completed === stats.total;

    // ── Playbook selection view ──
    if (!selectedPlaybook || !checklist) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ClipboardCheck className="h-6 w-6 text-primary" />
                        Pre-Trade Checklist
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Select a strategy from your playbooks to generate a pre-trade checklist.
                    </p>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {error && (
                    <div className="text-center py-12">
                        <p className="text-destructive">{error}</p>
                        <Button variant="outline" className="mt-4" onClick={fetchPlaybooks}>
                            Retry
                        </Button>
                    </div>
                )}

                {!loading && !error && playbooks.length === 0 && (
                    <div className="text-center py-12">
                        <BookMarked className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-semibold">No playbooks found</h3>
                        <p className="text-muted-foreground mt-1">
                            Create a playbook first in the Playbooks page, then come back here to generate a checklist.
                        </p>
                    </div>
                )}

                {!loading && !error && playbooks.length > 0 && (
                    <motion.div
                        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: { opacity: 1, transition: { staggerChildren: 0.08 } },
                        }}
                    >
                        {playbooks.map((pb) => (
                            <motion.div
                                key={pb.id}
                                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            >
                                <Card
                                    className="card-hover cursor-pointer group h-full transition-all hover:border-primary/40"
                                    onClick={() => handleSelectPlaybook(pb)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                                <BookMarked className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-semibold">{pb.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground">
                                                    {(pb.rules || []).length} rules
                                                </p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {pb.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {pb.description}
                                            </p>
                                        )}

                                        <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                                            <div className="flex items-center gap-1.5">
                                                <Target className="h-3.5 w-3.5 text-green-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Win</p>
                                                    <p className="text-sm font-semibold">{pb.winRate}%</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">R:R</p>
                                                    <p className="text-sm font-semibold">{pb.avgRR}:1</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Activity className="h-3.5 w-3.5 text-purple-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Trades</p>
                                                    <p className="text-sm font-semibold">{pb.totalTrades}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {pb.tags && pb.tags.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                                {pb.tags.map((tag) => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">
                                                        <Tag className="h-2.5 w-2.5 mr-0.5" />{tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <span className="text-xs text-primary font-medium group-hover:underline flex items-center gap-1">
                                                Generate Checklist <ChevronRight className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        );
    }

    // ── Checklist view ──
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <ClipboardCheck className="h-6 w-6 text-primary" />
                            {checklist.strategy_name}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Pre-trade checklist &middot; Generated {new Date(checklist.generated_at).toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
            <Card className={`border ${allChecked ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {allChecked ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                            )}
                            <span className="text-sm font-medium">
                                {allChecked
                                    ? 'All conditions met — Trade is VALID'
                                    : `${stats.completed} of ${stats.total} conditions checked`}
                            </span>
                        </div>
                        <span className={`text-sm font-bold ${allChecked ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                            {stats.percent}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${allChecked ? 'bg-emerald-500' : 'bg-primary'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.percent}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Checklist sections */}
            <div className="space-y-4">
                {checklist.checklist_sections.map((section) => {
                    if (section.items.length === 0) return null;

                    const Icon = SECTION_ICONS[section.section] || ClipboardCheck;
                    const colorClass = SECTION_COLORS[section.section] || 'text-muted-foreground';
                    const bgClass = SECTION_BG[section.section] || 'bg-muted/50 border-border';
                    const isCollapsed = collapsedSections[section.section];
                    const sectionChecked = section.items.filter((item) => checked[item.id]).length;
                    const sectionTotal = section.items.length;
                    const sectionComplete = sectionChecked === sectionTotal;

                    return (
                        <motion.div
                            key={section.section}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className={`border ${sectionComplete ? 'border-emerald-500/30' : ''}`}>
                                {/* Section header — collapsible */}
                                <button
                                    className="w-full text-left"
                                    onClick={() => toggleSection(section.section)}
                                >
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${bgClass}`}>
                                                    {React.createElement(Icon as React.ElementType<{ className: string }>, { className: `h-4 w-4 ${colorClass}` })}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold">{section.section}</h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {sectionChecked}/{sectionTotal} completed
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {sectionComplete && (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                                )}
                                                {isCollapsed ? (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                </button>

                                {/* Section items */}
                                <AnimatePresence initial={false}>
                                    {!isCollapsed && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <CardContent className="pt-0 pb-3 px-4">
                                                <div className="space-y-1 border-t pt-3">
                                                    {section.items.map((item) => {
                                                        const isChecked = !!checked[item.id];
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                className={`w-full text-left flex items-start gap-3 py-2.5 px-3 rounded-lg transition-all ${
                                                                    isChecked
                                                                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                                                        : 'hover:bg-muted/50'
                                                                }`}
                                                                onClick={() => toggleCheck(item.id)}
                                                            >
                                                                <div className="mt-0.5 shrink-0">
                                                                    {isChecked ? (
                                                                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                                                    ) : (
                                                                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-medium leading-snug ${
                                                                        isChecked ? 'text-emerald-300 line-through opacity-70' : 'text-foreground'
                                                                    }`}>
                                                                        {item.rule}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {item.description}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Trade valid / invalid status */}
            <motion.div
                layout={true}
                className={`rounded-xl border p-6 text-center transition-all ${
                    allChecked
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                }`}
            >
                {allChecked ? (
                    <>
                        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-emerald-400">TRADE VALID</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            All checklist conditions are met. You may execute this trade.
                        </p>
                    </>
                ) : (
                    <>
                        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-amber-400">TRADE NOT READY</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {stats.total - stats.completed} condition{stats.total - stats.completed !== 1 ? 's' : ''} remaining.
                            Complete all items before executing.
                        </p>
                    </>
                )}
            </motion.div>
        </div>
    );
}
