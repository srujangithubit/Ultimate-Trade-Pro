'use client';

import { useState, useRef, useEffect } from 'react';
import {
    MousePointer2,
    Crosshair,
    Minus,
    TrendingUp,
    MoveUpRight,
    GitBranch,
    RectangleHorizontal,
    Type,
    Ruler,
    ArrowUpFromLine,
    ArrowDownToLine,
    ZoomIn,
    ZoomOut,
    Magnet,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Trash2,
    Smile,
    PencilLine,
} from 'lucide-react';
import type { DrawingTool } from '@/lib/hooks/useChartDrawings';

/* ─── Sub-menu definition ────────────────────────────────────────────────── */

interface SubItem {
    id: DrawingTool;
    label: string;
    icon: React.ReactNode;
}

interface ToolGroup {
    /** primary tool shown on the toolbar */
    primary: { id: DrawingTool; label: string; icon: React.ReactNode };
    /** optional fly-out sub-items (first = primary is implicit) */
    sub?: SubItem[];
    section: 'top' | 'draw' | 'annotate' | 'action';
}

/* ─── Static sub-components ──────────────────────────────────────────── */
const Divider = () => <div className="w-5.5 h-px bg-zinc-700 my-1" />;

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface ChartToolbarProps {
    activeTool: DrawingTool;
    onToolChange: (tool: DrawingTool) => void;
    pendingClick?: boolean;
    isLocked?: boolean;
    isMagnet?: boolean;
    isVisible?: boolean;
}

export default function ChartToolbar({
    activeTool,
    onToolChange,
    pendingClick,
    isLocked,
    isMagnet,
    isVisible,
}: ChartToolbarProps) {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Close fly-out on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ── Tool definitions (matching TradingView order from screenshot) ── */
    const GROUPS: ToolGroup[] = [
        // 1. Cursor / Crosshair
        {
            primary: { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={18} /> },
            sub: [
                { id: 'cursor', label: 'Cursor', icon: <MousePointer2 size={16} /> },
                { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={16} /> },
            ],
            section: 'top',
        },
        // 2. Trend Line / Lines
        {
            primary: { id: 'trendline', label: 'Trend Line', icon: <TrendingUp size={18} /> },
            sub: [
                { id: 'trendline', label: 'Trend Line', icon: <TrendingUp size={16} /> },
                { id: 'ray', label: 'Ray', icon: <MoveUpRight size={16} /> },
                { id: 'hline', label: 'Horizontal Line', icon: <Minus size={16} /> },
            ],
            section: 'draw',
        },
        // 3. Horizontal line
        {
            primary: { id: 'hline', label: 'Horizontal Line', icon: <Minus size={18} /> },
            section: 'draw',
        },
        // 4. Fibonacci / Channels
        {
            primary: { id: 'fibonacci', label: 'Fibonacci Retracement', icon: <GitBranch size={18} /> },
            section: 'draw',
        },
        // 5. Rectangle / Range
        {
            primary: { id: 'rectangle', label: 'Price Range', icon: <RectangleHorizontal size={18} /> },
            section: 'draw',
        },
        // 6. Long / Short position
        {
            primary: { id: 'long-position', label: 'Long Position', icon: <ArrowUpFromLine size={18} /> },
            sub: [
                { id: 'long-position', label: 'Long Position', icon: <ArrowUpFromLine size={16} /> },
                { id: 'short-position', label: 'Short Position', icon: <ArrowDownToLine size={16} /> },
            ],
            section: 'draw',
        },
        // 7. Text
        {
            primary: { id: 'text', label: 'Text Note', icon: <Type size={18} /> },
            section: 'annotate',
        },
        // 8. Emoji
        {
            primary: { id: 'cursor', label: 'Emoji', icon: <Smile size={18} /> },
            section: 'annotate',
        },
        // 9. Measure / Ruler
        {
            primary: { id: 'measure', label: 'Measure', icon: <Ruler size={18} /> },
            section: 'annotate',
        },
        // 10. Zoom
        {
            primary: { id: 'zoom-in', label: 'Zoom In', icon: <ZoomIn size={18} /> },
            sub: [
                { id: 'zoom-in', label: 'Zoom In', icon: <ZoomIn size={16} /> },
                { id: 'zoom-out', label: 'Zoom Out', icon: <ZoomOut size={16} /> },
            ],
            section: 'action',
        },
        // 11. Magnet
        {
            primary: { id: 'magnet', label: 'Magnet Mode', icon: <Magnet size={18} /> },
            section: 'action',
        },
        // 12. Eraser
        {
            primary: { id: 'eraser', label: 'Remove Last', icon: <PencilLine size={18} /> },
            section: 'action',
        },
        // 13. Lock
        {
            primary: {
                id: 'lock',
                label: isLocked ? 'Unlock Drawings' : 'Lock Drawings',
                icon: isLocked ? <Unlock size={18} /> : <Lock size={18} />,
            },
            section: 'action',
        },
        // 14. Show/Hide
        {
            primary: {
                id: 'show-hide',
                label: isVisible !== false ? 'Hide Drawings' : 'Show Drawings',
                icon: isVisible !== false ? <Eye size={18} /> : <EyeOff size={18} />,
            },
            section: 'action',
        },
        // 15. Trash
        {
            primary: { id: 'trash', label: 'Delete All', icon: <Trash2 size={18} /> },
            section: 'action',
        },
    ];

    const ACTION_IDS = new Set<DrawingTool>([
        'trash', 'eraser', 'lock', 'show-hide', 'zoom-in', 'zoom-out', 'magnet',
    ]);

    const topGroups      = GROUPS.filter((g) => g.section === 'top');
    const drawGroups     = GROUPS.filter((g) => g.section === 'draw');
    const annotateGroups = GROUPS.filter((g) => g.section === 'annotate');
    const actionGroups   = GROUPS.filter((g) => g.section === 'action');

    const renderGroup = (group: ToolGroup, idx: number) => {
        const { primary, sub } = group;
        const key = `${primary.id}-${idx}`;
        const isAction = ACTION_IDS.has(primary.id);
        const isActive = !isAction && activeTool === primary.id;
        const isStateful = (primary.id === 'magnet' && isMagnet) || (primary.id === 'lock' && isLocked);
        const highlight = isActive || isStateful;
        const hasSub = sub && sub.length > 1;
        const isOpen = openMenu === key;

        return (
            <div key={key} className="relative group">
                <button
                    title={primary.label}
                    onClick={() => {
                        onToolChange(primary.id);
                        setOpenMenu(null);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (hasSub) setOpenMenu(isOpen ? null : key);
                    }}
                    className={`
                        relative w-9.5 h-9.5 rounded-md flex items-center justify-center transition-all duration-150
                        ${highlight
                            ? 'bg-indigo-500/15 text-indigo-400'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}
                    `}
                >
                    {primary.icon}
                    {/* Pending click indicator */}
                    {isActive && pendingClick && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    )}
                    {/* Sub-menu triangle */}
                    {hasSub && (
                        <span className="absolute bottom-0.75 right-0.75 border-[3px] border-transparent border-b-zinc-500 border-r-zinc-500" />
                    )}
                </button>

                {/* Fly-out sub-menu */}
                {hasSub && isOpen && (
                    <div className="absolute left-full top-0 ml-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-40">
                        {sub.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onToolChange(item.id);
                                    setOpenMenu(null);
                                }}
                                className={`
                                    w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors
                                    ${activeTool === item.id
                                        ? 'text-indigo-400 bg-indigo-500/10'
                                        : 'text-zinc-300 hover:text-white hover:bg-zinc-700/60'}
                                `}
                            >
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={toolbarRef}
            className="w-11.5 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto overflow-x-hidden scrollbar-none"
        >
            {topGroups.map(renderGroup)}
            <Divider />
            {drawGroups.map(renderGroup)}
            <Divider />
            {annotateGroups.map(renderGroup)}
            {/* push actions to the bottom */}
            <div className="flex-1 min-h-2" />
            <Divider />
            {actionGroups.map(renderGroup)}
        </div>
    );
}
