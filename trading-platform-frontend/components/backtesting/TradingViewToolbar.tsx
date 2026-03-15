'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  TOOL_GROUPS, ACTION_TOOLS, NON_DRAWING_IDS,
  TOOLS, ICONS, type DrawingToolId, type ToolGroupDef, type IconDef,
} from '@/lib/drawing/tools';

/* ─── Props ───────────────────────────────────────────────────────────── */

interface TradingViewToolbarProps {
  activeTool: DrawingToolId;
  onToolChange: (tool: DrawingToolId) => void;
  pendingClick?: boolean;
  isLocked?: boolean;
  isMagnet?: boolean;
  isVisible?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

/* ─── SVG icon from registry (supports simple string or multi-path) ──── */

function ToolIcon({ id, size = 20 }: { id: string; size?: number }) {
  const def: IconDef | undefined = ICONS[id];
  if (!def) return <span className="w-5 h-5" />;

  if (typeof def === 'string') {
    return (
      <svg viewBox="0 0 28 28" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={def} />
      </svg>
    );
  }

  // Array of { d, fill?, stroke?, text? }
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      {def.map((p: { d: string; fill?: boolean; stroke?: boolean; text?: boolean }, i: number) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ? 'currentColor' : 'none'}
          stroke={p.stroke !== false && !p.fill ? 'currentColor' : (p.stroke ? 'currentColor' : 'none')}
          strokeWidth={p.text ? 0 : 2}
          opacity={p.text ? 0.5 : 1}
        />
      ))}
    </svg>
  );
}

function Divider() {
  return <div className="w-6 h-px bg-[#363A45] my-1 mx-auto" />;
}

/* ─── Main component ──────────────────────────────────────────────────── */

export default function TradingViewToolbar({
  activeTool,
  onToolChange,
  pendingClick,
  isLocked,
  isMagnet,
  isVisible,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: TradingViewToolbarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Track which sub-tool was last selected per group
  const [selectedPerGroup, setSelectedPerGroup] = useState<Record<string, DrawingToolId>>({});
  const barRef = useRef<HTMLDivElement>(null);

  /* ── Flyout position state ──────────────────────────────────────────── */
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const flyoutRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Update outside-click handler to also check the portal flyout
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        barRef.current && !barRef.current.contains(target) &&
        (!flyoutRef.current || !flyoutRef.current.contains(target))
      ) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openFlyout = useCallback((groupId: string) => {
    const btn = btnRefs.current[groupId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 4 });
    }
    setOpenGroup(groupId);
  }, []);

  // Get the representative tool for a group (last selected or first)
  const repFor = (g: ToolGroupDef): DrawingToolId => selectedPerGroup[g.id] || g.tools[0];

  const selectTool = (toolId: DrawingToolId, groupId?: string) => {
    if (groupId) {
      setSelectedPerGroup(prev => ({ ...prev, [groupId]: toolId }));
    }
    onToolChange(toolId);
    setOpenGroup(null);
  };

  /* ── Render one toolbar group (icon button + optional flyout) ─────── */
  const renderGroup = (group: ToolGroupDef) => {
    const rep = repFor(group);
    const meta = TOOLS[rep];
    const isAction = NON_DRAWING_IDS.has(rep);
    const isActive = !isAction && group.tools.includes(activeTool);
    const isOpen = openGroup === group.id;
    const hasSub = group.tools.length > 1;

    return (
      <div key={group.id} className="relative">
        {/* Primary button */}
        <button
          ref={(el) => { btnRefs.current[group.id] = el; }}
          title={`${meta.label}${meta.shortcut ? ` (${meta.shortcut})` : ''}`}
          onClick={() => {
            if (hasSub) {
              if (isOpen) {
                setOpenGroup(null);
              } else {
                openFlyout(group.id);
              }
            } else {
              selectTool(rep, group.id);
            }
          }}
          className={`
            relative w-9.5 h-9.5 rounded flex items-center justify-center transition-all duration-100
            ${isActive
              ? 'bg-[#2962FF]/20 text-[#5B9CF6]'
              : 'text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]'}
          `}
        >
          <ToolIcon id={rep} size={18} />
          {isActive && pendingClick && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
          {hasSub && (
            <svg className="absolute bottom-0.5 right-0.5" width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><path d="M0 0L5 5H0z"/></svg>
          )}
        </button>

        {/* Fly-out sub-menu rendered via portal to escape overflow:hidden ancestors */}
        {hasSub && isOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={flyoutRef}
            className="fixed z-9999 bg-[#1E222D] border border-[#363A45] rounded shadow-2xl py-1 min-w-50 max-h-[80vh] overflow-y-auto"
            style={{ top: flyoutPos.top, left: flyoutPos.left, scrollbarWidth: 'thin' }}
          >
            {group.tools.map((tid: DrawingToolId, idx: number) => {
              const tm = TOOLS[tid];
              const section = group.sections?.find((s: { label: string; start: number }) => s.start === idx);
              return (
                <div key={tid}>
                  {section && (
                    <div className={`px-3 py-1.25 text-[10px] font-semibold tracking-wider text-[#787B86] ${idx > 0 ? 'mt-1 border-t border-[#363A45]' : ''}`}>
                      {section.label}
                    </div>
                  )}
                  <button
                    onClick={() => selectTool(tid, group.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-1.75 text-[12px] transition-colors
                      ${activeTool === tid
                        ? 'text-[#5B9CF6] bg-[#2962FF]/10'
                        : 'text-[#D1D4DC] hover:text-white hover:bg-[#2A2E39]'}
                    `}
                  >
                    <ToolIcon id={tid} size={16} />
                    <span className="font-medium">{tm.label}</span>
                    {tm.shortcut && (
                      <span className="ml-auto text-[10px] text-[#787B86]">{tm.shortcut}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    );
  };

  /* ── Render action button ─────────────────────────────────────────── */
  const renderAction = (tid: DrawingToolId) => {
    const tm = TOOLS[tid];
    const isStateful =
      (tid === 'magnet' && isMagnet) ||
      (tid === 'lock' && isLocked) ||
      (tid === 'show-hide' && isVisible === false);

    return (
      <button
        key={tid}
        title={tm.label}
        onClick={() => onToolChange(tid)}
        className={`
          w-9.5 h-9.5 rounded flex items-center justify-center transition-all duration-100
          ${isStateful
            ? 'bg-[#2962FF]/20 text-[#5B9CF6]'
            : 'text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]'}
        `}
      >
        <ToolIcon id={tid} size={18} />
      </button>
    );
  };


  return (
    <div
      ref={barRef}
      className="w-11.5 bg-[#131722] border-r border-[#1E222D] flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto overflow-x-hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* Tool groups */}
      {TOOL_GROUPS.map((g: ToolGroupDef, i: number) => (
        <div key={g.id}>
          {renderGroup(g)}
          {/* Dividers after: cursor(0), forks(2), forecast(5), annotation(6), arrows(7) */}
          {(i === 0 || i === 2 || i === 5 || i === 6 || i === 7) && <Divider />}
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1 min-h-2" />
      <Divider />

      {/* Undo / Redo */}
      {onUndo && (
        <button
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-9.5 h-9.5 rounded flex items-center justify-center transition-all duration-100
            ${canUndo ? 'text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]' : 'text-[#363A45] cursor-default'}`}
        >
          <svg viewBox="0 0 28 28" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5-5M5 12l5 5M5 12h13a6 6 0 110 12h-3" />
          </svg>
        </button>
      )}
      {onRedo && (
        <button
          title="Redo (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
          className={`w-9.5 h-9.5 rounded flex items-center justify-center transition-all duration-100
            ${canRedo ? 'text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]' : 'text-[#363A45] cursor-default'}`}
        >
          <svg viewBox="0 0 28 28" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 12l-5-5M23 12l-5 5M23 12H10a6 6 0 100 12h3" />
          </svg>
        </button>
      )}
      <Divider />

      {/* Action tools */}
      {ACTION_TOOLS.map(renderAction)}
    </div>
  );
}
