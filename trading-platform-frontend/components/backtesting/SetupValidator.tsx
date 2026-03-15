'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Loader2,
    TrendingUp,
    TrendingDown,
    Minus,
    ShieldCheck,
    ShieldAlert,
    Target,
    Eye,
    BarChart3,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { playbooksApi, Playbook } from '@/lib/api/playbooks';
import { chartValidationApi, ChartValidationResult, ChecklistValidationItem } from '@/lib/api/chart-validation';
import { generateChecklist, GeneratedChecklist } from '@/lib/checklist-generator';

interface SetupValidatorProps {
    open: boolean;
    onClose: () => void;
    chartContainerRef: React.RefObject<HTMLDivElement | null>;
    timeframe: string;
}

type Phase = 'select-playbook' | 'validating' | 'results';

const QUALITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'A+': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    'A': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    'B': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    'C': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    'Invalid': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    valid: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    invalid: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
    undetected: <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />,
};

function captureChart(container: HTMLDivElement): Promise<string> {
    return new Promise((resolve, reject) => {
        // Lightweight Charts renders to a canvas inside the container
        const canvases = container.querySelectorAll('canvas');
        if (canvases.length === 0) {
            reject(new Error('No chart canvas found'));
            return;
        }

        // Composite canvases onto a small offscreen canvas (512px wide for fast local model inference)
        const rect = container.getBoundingClientRect();
        const maxWidth = 512;
        const scale = Math.min(maxWidth / rect.width, 1);
        const outW = Math.round(rect.width * scale);
        const outH = Math.round(rect.height * scale);
        const offscreen = document.createElement('canvas');
        offscreen.width = outW;
        offscreen.height = outH;
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, outW, outH);

        canvases.forEach((canvas) => {
            const canvasRect = canvas.getBoundingClientRect();
            const x = (canvasRect.left - rect.left) * scale;
            const y = (canvasRect.top - rect.top) * scale;
            const w = canvasRect.width * scale;
            const h = canvasRect.height * scale;
            ctx.drawImage(canvas, x, y, w, h);
        });

        // JPEG at 60% quality — ~5-10x smaller than full-res PNG
        resolve(offscreen.toDataURL('image/jpeg', 0.6));
    });
}

export function SetupValidator({ open, onClose, chartContainerRef, timeframe }: SetupValidatorProps) {
    const [phase, setPhase] = useState<Phase>('select-playbook');
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [result, setResult] = useState<ChartValidationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['checklist', 'market', 'risk']));

    // Fetch playbooks when panel opens
    useEffect(() => {
        if (!open) return;
        setLoadingPlaybooks(true);
        playbooksApi.getAll()
            .then(setPlaybooks)
            .catch(() => setError('Failed to load playbooks'))
            .finally(() => setLoadingPlaybooks(false));
    }, [open]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setPhase('select-playbook');
            setSelectedPlaybook(null);
            setResult(null);
            setError(null);
        }
    }, [open]);

    const handleSelectPlaybook = useCallback(async (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        setPhase('validating');
        setError(null);

        try {
            // 1. Capture chart screenshot
            if (!chartContainerRef.current) throw new Error('Chart not available');
            const screenshot = await captureChart(chartContainerRef.current);

            // 2. Generate checklist from playbook
            const checklist: GeneratedChecklist = generateChecklist(playbook);
            const flatItems = checklist.checklist_sections.flatMap((s) =>
                s.items.map((item) => ({ id: item.id, rule: item.rule, type: item.type }))
            );

            // 3. Call validation API
            const validationResult = await chartValidationApi.validate({
                strategy_name: playbook.name,
                strategy_rules: playbook.rules || [],
                checklist: flatItems,
                screenshot,
                timeframe,
            });

            setResult(validationResult);
            setPhase('results');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Validation failed');
            setPhase('select-playbook');
        }
    }, [chartContainerRef, timeframe]);

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const qualityStyle = useMemo(() => {
        if (!result) return QUALITY_COLORS['Invalid'];
        return QUALITY_COLORS[result.setup_quality] || QUALITY_COLORS['Invalid'];
    }, [result]);

    const trendIcon = useMemo(() => {
        const dir = result?.detected_market_conditions?.trend_direction;
        if (dir === 'bullish') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
        if (dir === 'bearish') return <TrendingDown className="w-4 h-4 text-red-400" />;
        return <Minus className="w-4 h-4 text-amber-400" />;
    }, [result]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed top-0 right-0 bottom-0 w-105 bg-card border-l border-border z-50 flex flex-col shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-sm font-bold text-foreground">Setup Validator</h2>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {/* PHASE 1: Select Playbook */}
                            {phase === 'select-playbook' && (
                                <motion.div
                                    key="select"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 space-y-3"
                                >
                                    <p className="text-xs text-muted-foreground">
                                        Select a strategy to validate your current chart setup against.
                                    </p>

                                    {error && (
                                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <p className="text-xs text-red-400">{error}</p>
                                        </div>
                                    )}

                                    {loadingPlaybooks ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : playbooks.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p className="text-sm">No playbooks found.</p>
                                            <p className="text-xs mt-1">Create a playbook first from the Playbooks page.</p>
                                        </div>
                                    ) : (
                                        playbooks.map((pb) => (
                                            <button
                                                key={pb.id}
                                                onClick={() => handleSelectPlaybook(pb)}
                                                className="w-full text-left bg-muted/50 hover:bg-muted border border-border hover:border-indigo-500/30 rounded-lg p-3 transition-all group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-foreground group-hover:text-indigo-400 transition-colors">
                                                        {pb.name}
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400" />
                                                </div>
                                                {pb.description && (
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{pb.description}</p>
                                                )}
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {pb.rules?.length || 0} rules &middot; {pb.totalTrades} trades &middot; {pb.winRate}% WR
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </motion.div>
                            )}

                            {/* PHASE 2: Validating */}
                            {phase === 'validating' && (
                                <motion.div
                                    key="validating"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center py-16 px-4 gap-4"
                                >
                                    <div className="relative">
                                        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                                        <ShieldCheck className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-foreground">Analyzing Chart Setup</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Validating against <span className="text-indigo-400">{selectedPlaybook?.name}</span>
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground space-y-1 text-center max-w-62.5">
                                        <p>Scanning market structure...</p>
                                        <p>Evaluating checklist rules...</p>
                                        <p>Calculating trade score...</p>
                                    </div>
                                </motion.div>
                            )}

                            {/* PHASE 3: Results */}
                            {phase === 'results' && result && (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 space-y-4"
                                >
                                    {/* Score Card */}
                                    <div className={`${qualityStyle.bg} ${qualityStyle.border} border rounded-lg p-4`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trade Score</span>
                                            <span className={`text-2xl font-bold font-mono ${qualityStyle.text}`}>
                                                {result.trade_score}%
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-lg font-bold ${qualityStyle.text}`}>
                                                {result.setup_quality === 'Invalid' ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <ShieldAlert className="w-5 h-5" /> INVALID TRADE
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5">
                                                        <ShieldCheck className="w-5 h-5" /> Grade {result.setup_quality}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="h-2 bg-muted/50 rounded-full mt-3 overflow-hidden">
                                            <motion.div
                                                className={`h-full rounded-full ${
                                                    result.trade_score >= 75 ? 'bg-emerald-500' :
                                                    result.trade_score >= 60 ? 'bg-amber-500' :
                                                    result.trade_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                                }`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${result.trade_score}%` }}
                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                            />
                                        </div>
                                        {/* Summary counts */}
                                        <div className="flex items-center gap-4 mt-3 text-xs">
                                            <span className="flex items-center gap-1 text-emerald-400">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> {result.summary.valid_count} Valid
                                            </span>
                                            <span className="flex items-center gap-1 text-red-400">
                                                <XCircle className="w-3.5 h-3.5" /> {result.summary.invalid_count} Invalid
                                            </span>
                                            <span className="flex items-center gap-1 text-amber-400">
                                                <HelpCircle className="w-3.5 h-3.5" /> {result.summary.undetected_count} Undetected
                                            </span>
                                        </div>
                                    </div>

                                    {/* Final Assessment */}
                                    <div className="bg-muted/50 border border-border rounded-lg p-3">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Assessment</p>
                                        <p className="text-xs text-foreground leading-relaxed">{result.final_assessment}</p>
                                    </div>

                                    {/* Checklist Validation */}
                                    <CollapsibleSection
                                        title="Checklist Validation"
                                        icon={<Target className="w-4 h-4 text-indigo-400" />}
                                        isOpen={expandedSections.has('checklist')}
                                        onToggle={() => toggleSection('checklist')}
                                    >
                                        <div className="space-y-2">
                                            {result.checklist_validation.map((item: ChecklistValidationItem) => (
                                                <div
                                                    key={item.id}
                                                    className={`rounded-lg p-2.5 border ${
                                                        item.status === 'valid' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                        item.status === 'invalid' ? 'bg-red-500/5 border-red-500/20' :
                                                        'bg-amber-500/5 border-amber-500/20'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        {STATUS_ICON[item.status]}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-foreground">{item.rule}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.explanation}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleSection>

                                    {/* Detected Market Conditions */}
                                    <CollapsibleSection
                                        title="Detected Market Conditions"
                                        icon={<Eye className="w-4 h-4 text-cyan-400" />}
                                        isOpen={expandedSections.has('market')}
                                        onToggle={() => toggleSection('market')}
                                    >
                                        <div className="space-y-2 text-xs">
                                            <div className="grid grid-cols-2 gap-2">
                                                <InfoCard label="Trend" value={
                                                    <span className="flex items-center gap-1">
                                                        {trendIcon} {result.detected_market_conditions.trend_direction}
                                                    </span>
                                                } />
                                                <InfoCard label="Timeframe" value={result.detected_market_conditions.timeframe || 'N/A'} />
                                                <InfoCard label="Session" value={result.detected_market_conditions.session || 'N/A'} />
                                                <InfoCard label="Structure" value={result.detected_market_conditions.market_structure || 'N/A'} />
                                            </div>

                                            {result.detected_market_conditions.key_levels?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Key Levels</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.detected_market_conditions.key_levels.map((l, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-foreground">{l}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {result.detected_market_conditions.candlestick_patterns?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Candlestick Patterns</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.detected_market_conditions.candlestick_patterns.map((p, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-foreground">{p}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {result.detected_market_conditions.fibonacci_levels_detected?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Fibonacci Levels</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.detected_market_conditions.fibonacci_levels_detected.map((f, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-purple-500/20 rounded text-[10px] text-purple-400">{f}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {result.detected_market_conditions.indicators_visible?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Indicators</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.detected_market_conditions.indicators_visible.map((ind, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-blue-500/20 rounded text-[10px] text-blue-400">{ind}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsibleSection>

                                    {/* Risk Analysis */}
                                    <CollapsibleSection
                                        title="Risk Analysis"
                                        icon={<BarChart3 className="w-4 h-4 text-amber-400" />}
                                        isOpen={expandedSections.has('risk')}
                                        onToggle={() => toggleSection('risk')}
                                    >
                                        <div className="space-y-2 text-xs">
                                            <div className="grid grid-cols-3 gap-2">
                                                <RiskBadge label="Entry" visible={result.risk_analysis.entry_visible} />
                                                <RiskBadge label="Stop Loss" visible={result.risk_analysis.stop_loss_visible} />
                                                <RiskBadge label="Take Profit" visible={result.risk_analysis.take_profit_visible} />
                                            </div>
                                            {result.risk_analysis.risk_reward_estimate && (
                                                <div className="flex items-center justify-between bg-muted/50 rounded p-2">
                                                    <span className="text-muted-foreground">Risk:Reward</span>
                                                    <span className={`font-mono font-bold ${result.risk_analysis.risk_reward_valid ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {result.risk_analysis.risk_reward_estimate}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsibleSection>

                                    {/* Re-validate / Back */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => { setPhase('select-playbook'); setResult(null); }}
                                            className="flex-1 bg-muted hover:bg-accent border border-border text-foreground py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => selectedPlaybook && handleSelectPlaybook(selectedPlaybook)}
                                            className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            Re-validate
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Collapsible Section ──

function CollapsibleSection({
    title, icon, isOpen, onToggle, children,
}: {
    title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-xs font-bold text-foreground">{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 border-t border-border">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Info Card ──

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="bg-muted/50 rounded p-2">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{label}</p>
            <p className="text-xs text-foreground font-medium mt-0.5 capitalize">{value}</p>
        </div>
    );
}

// ── Risk Badge ──

function RiskBadge({ label, visible }: { label: string; visible: boolean }) {
    return (
        <div className={`rounded p-2 text-center ${visible ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{label}</p>
            <p className={`text-xs font-bold mt-0.5 ${visible ? 'text-emerald-400' : 'text-red-400'}`}>
                {visible ? 'Visible' : 'Not Found'}
            </p>
        </div>
    );
}
