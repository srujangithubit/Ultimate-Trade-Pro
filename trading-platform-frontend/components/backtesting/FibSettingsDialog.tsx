'use client';

import { useState, useCallback, useRef } from 'react';
import type { DrawingObject, DrawingConfig, FibLevelConfig } from '@/lib/drawing/types';

/** Default levels with colors */
const DEFAULT_FIB_LEVELS: FibLevelConfig[] = [
  { r: 0,     enabled: true,  color: '#787B86' },
  { r: 0.236, enabled: true,  color: '#F44336' },
  { r: 0.382, enabled: true,  color: '#FF9800' },
  { r: 0.5,   enabled: true,  color: '#4CAF50' },
  { r: 0.618, enabled: true,  color: '#009688' },
  { r: 0.786, enabled: true,  color: '#2196F3' },
  { r: 1,     enabled: true,  color: '#787B86' },
  { r: 1.618, enabled: false, color: '#2196F3' },
  { r: 2.618, enabled: false, color: '#F44336' },
  { r: 4.236, enabled: false, color: '#9C27B0' },
  { r: 1.272, enabled: false, color: '#FF9800' },
  { r: 2.272, enabled: false, color: '#FF9800' },
  { r: 1.414, enabled: false, color: '#F44336' },
  { r: 2.414, enabled: false, color: '#4CAF50' },
  { r: 3,     enabled: false, color: '#00BCD4' },
  { r: 3.272, enabled: false, color: '#9E9E9E' },
  { r: 3.414, enabled: false, color: '#2196F3' },
  { r: 2,     enabled: false, color: '#4CAF50' },
  { r: 3.618, enabled: false, color: '#9C27B0' },
  { r: 4,     enabled: false, color: '#F44336' },
];

export { DEFAULT_FIB_LEVELS };

interface FibSettingsDialogProps {
  drawing: DrawingObject;
  onApply: (id: string, updates: Partial<DrawingObject>) => void;
  onClose: () => void;
}

export function FibSettingsDialog({ drawing, onApply, onClose }: FibSettingsDialogProps) {
  const [tab, setTab] = useState<'style' | 'coordinates' | 'visibility'>('style');
  const cfg = drawing.config ?? {};

  // ── Local state from drawing config or defaults ──
  const [showTrendLine, setShowTrendLine] = useState(cfg.showTrendLine ?? true);
  const [trendLineColor, setTrendLineColor] = useState(cfg.trendLineColor ?? '#787B86');
  const [trendLineStyle, setTrendLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(cfg.trendLineStyle ?? 'dashed');
  const [levelsLineStyle, setLevelsLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(cfg.levelsLineStyle ?? 'solid');
  const [levelsLineWidth, setLevelsLineWidth] = useState(cfg.levelsLineWidth ?? 1);
  const [extend, setExtend] = useState<'none' | 'left' | 'right' | 'both'>(cfg.extend ?? 'none');
  const [levels, setLevels] = useState<FibLevelConfig[]>(() =>
    cfg.fibLevels && cfg.fibLevels.length > 0 ? [...cfg.fibLevels] : [...DEFAULT_FIB_LEVELS],
  );

  // ── String-based editing for ratio inputs ──
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditingRatio = useCallback((idx: number, currentR: number) => {
    setEditingIdx(idx);
    setEditingValue(String(currentR));
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const commitRatioEdit = useCallback(() => {
    if (editingIdx === null) return;
    const r = parseFloat(editingValue);
    if (!isNaN(r) && isFinite(r) && r >= 0) {
      setLevels(prev => prev.map((lv, i) => i === editingIdx ? { ...lv, r } : lv));
    }
    setEditingIdx(null);
    setEditingValue('');
  }, [editingIdx, editingValue]);

  const toggleLevel = useCallback((idx: number) => {
    setLevels(prev => prev.map((lv, i) => i === idx ? { ...lv, enabled: !lv.enabled } : lv));
  }, []);

  const updateLevelColor = useCallback((idx: number, color: string) => {
    setLevels(prev => prev.map((lv, i) => i === idx ? { ...lv, color } : lv));
  }, []);

  const handleApply = useCallback(() => {
    // Commit any in-flight ratio edit
    if (editingIdx !== null) {
      const r = parseFloat(editingValue);
      if (!isNaN(r) && isFinite(r) && r >= 0) {
        setLevels(prev => prev.map((lv, i) => i === editingIdx ? { ...lv, r } : lv));
      }
      setEditingIdx(null);
    }
    const newConfig: DrawingConfig = {
      fibLevels: levels,
      showTrendLine,
      trendLineColor,
      trendLineStyle,
      levelsLineStyle,
      levelsLineWidth,
      extend,
    };
    onApply(drawing.id, { config: newConfig });
  }, [drawing.id, levels, showTrendLine, trendLineColor, trendLineStyle, levelsLineStyle, levelsLineWidth, extend, onApply, editingIdx, editingValue]);

  const handleResetDefaults = useCallback(() => {
    setLevels([...DEFAULT_FIB_LEVELS]);
    setShowTrendLine(true);
    setTrendLineColor('#787B86');
    setTrendLineStyle('dashed');
    setLevelsLineStyle('solid');
    setLevelsLineWidth(1);
    setExtend('none');
  }, []);

  const priceDecimals = drawing.points[0]?.price > 10 ? 2 : 5;

  /** Render a single level row */
  const renderLevelRow = (lv: FibLevelConfig, realIdx: number) => (
    <div key={realIdx} className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={lv.enabled}
        onChange={() => toggleLevel(realIdx)}
        className="w-4 h-4 rounded bg-[#2a2e39] border-[#363a45] accent-[#2962FF] shrink-0 cursor-pointer"
      />
      {editingIdx === realIdx ? (
        <input
          ref={inputRef}
          type="text"
          value={editingValue}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={commitRatioEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitRatioEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditingValue(''); } }}
          className="w-16 bg-[#131722] border border-[#2962FF] text-white text-sm rounded px-2 py-1 text-center font-mono outline-none"
          autoFocus
        />
      ) : (
        <button
          onClick={() => startEditingRatio(realIdx, lv.r)}
          className={`w-16 text-sm rounded px-2 py-1 text-center font-mono border transition cursor-pointer ${
            lv.enabled ? 'bg-[#2a2e39] border-[#363a45] text-[#d1d4dc] hover:border-[#506080]' : 'bg-[#2a2e39]/50 border-[#363a45]/50 text-[#787B86]'
          }`}
        >
          {lv.r}
        </button>
      )}
      <input
        type="color"
        value={lv.color}
        onChange={e => updateLevelColor(realIdx, e.target.value)}
        className="w-7 h-7 rounded border border-[#363a45] cursor-pointer bg-transparent shrink-0"
      />
    </div>
  );

  // Split levels into left and right columns
  const leftLevels = levels.map((lv, i) => ({ lv, i })).filter((_, idx) => idx % 2 === 0);
  const rightLevels = levels.map((lv, i) => ({ lv, i })).filter((_, idx) => idx % 2 === 1);

  /** Block pointer/mouse events from leaking to chart */
  const stopPointer = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
    >
      <div
        className="bg-[#1e222d] rounded-lg shadow-2xl border border-[#363a45] w-140 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#363a45]">
          <span className="text-white font-semibold text-base">Fib Retracement — Settings</span>
          <button onClick={onClose} className="text-[#787B86] hover:text-white text-xl leading-none px-1 transition cursor-pointer">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 px-5 pt-3 border-b border-[#363a45]">
          {(['style', 'coordinates', 'visibility'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium capitalize transition border-b-2 cursor-pointer ${
                tab === t ? 'text-white border-[#2962FF]' : 'text-[#787B86] border-transparent hover:text-white'
              }`}
            >
              {t === 'style' ? 'Style' : t === 'coordinates' ? 'Coordinates' : 'Visibility'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'style' && (
            <div className="space-y-5">
              {/* Trend line */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTrendLine}
                    onChange={e => setShowTrendLine(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#2a2e39] border-[#363a45] accent-[#2962FF] cursor-pointer"
                  />
                  <span className="text-[#d1d4dc] text-sm">Trend line</span>
                </label>
                <input
                  type="color"
                  value={trendLineColor}
                  onChange={e => setTrendLineColor(e.target.value)}
                  className="w-7 h-7 rounded border border-[#363a45] cursor-pointer bg-transparent"
                />
                <select
                  value={trendLineStyle}
                  onChange={e => setTrendLineStyle(e.target.value as 'solid' | 'dashed' | 'dotted')}
                  className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-xs rounded px-2 py-1 cursor-pointer"
                >
                  <option value="solid">───</option>
                  <option value="dashed">- - -</option>
                  <option value="dotted">· · ·</option>
                </select>
              </div>

              {/* Levels line */}
              <div className="flex items-center gap-3">
                <span className="text-[#d1d4dc] text-sm w-24">Levels line</span>
                <select
                  value={levelsLineStyle}
                  onChange={e => setLevelsLineStyle(e.target.value as 'solid' | 'dashed' | 'dotted')}
                  className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-xs rounded px-2 py-1 cursor-pointer"
                >
                  <option value="solid">───</option>
                  <option value="dashed">- - -</option>
                  <option value="dotted">· · ·</option>
                </select>
                <select
                  value={levelsLineWidth}
                  onChange={e => setLevelsLineWidth(Number(e.target.value))}
                  className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-xs rounded px-2 py-1 cursor-pointer"
                >
                  <option value={1}>1px — Thin</option>
                  <option value={2}>2px — Medium</option>
                  <option value={3}>3px — Thick</option>
                  <option value={4}>4px — Heavy</option>
                </select>
              </div>

              {/* Extend */}
              <div className="flex items-center gap-3">
                <span className="text-[#d1d4dc] text-sm w-24">Extend</span>
                <select
                  value={extend}
                  onChange={e => setExtend(e.target.value as 'none' | 'left' | 'right' | 'both')}
                  className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-sm rounded px-3 py-1.5 min-w-35 cursor-pointer"
                >
                  <option value="none">Don&apos;t extend</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="both">Both</option>
                </select>
              </div>

              {/* Levels Grid */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#787B86] text-xs uppercase tracking-wider font-medium">Levels</span>
                  <button
                    onClick={() => setLevels(prev => prev.map(lv => ({ ...lv, enabled: !prev.every(l => l.enabled) })))}
                    className="text-[#787B86] text-xs hover:text-white transition cursor-pointer"
                  >
                    Toggle all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {/* Left column */}
                  <div className="space-y-1.5">
                    {leftLevels.map(({ lv, i: realIdx }) => renderLevelRow(lv, realIdx))}
                  </div>
                  {/* Right column */}
                  <div className="space-y-1.5">
                    {rightLevels.map(({ lv, i: realIdx }) => renderLevelRow(lv, realIdx))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'coordinates' && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-16 text-[#787B86] font-medium">Point 1</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-[#787B86] text-xs">Price:</span>
                    <span className="font-mono text-[#d1d4dc]">{drawing.points[0]?.price.toFixed(priceDecimals)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#787B86] text-xs">Time:</span>
                    <span className="font-mono text-[#d1d4dc] text-xs">
                      {drawing.points[0]?.time ? new Date(drawing.points[0].time * 1000).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-[#787B86] font-medium">Point 2</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-[#787B86] text-xs">Price:</span>
                    <span className="font-mono text-[#d1d4dc]">{drawing.points[1]?.price.toFixed(priceDecimals)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#787B86] text-xs">Time:</span>
                    <span className="font-mono text-[#d1d4dc] text-xs">
                      {drawing.points[1]?.time ? new Date(drawing.points[1].time * 1000).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#2a2e39]/50 rounded text-[#787B86] text-xs">
                Drag the anchor points on the chart to adjust coordinates.
              </div>
            </div>
          )}

          {tab === 'visibility' && (
            <div className="space-y-3 text-sm">
              <p className="text-[#787B86] text-xs mb-3">This drawing is visible on all timeframes.</p>
              {['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'].map(tf => (
                <label key={tf} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    readOnly
                    className="w-4 h-4 rounded bg-[#2a2e39] border-[#363a45] accent-[#2962FF] cursor-pointer"
                  />
                  <span className="text-[#d1d4dc] font-mono text-xs">{tf}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#363a45]">
          <button
            onClick={handleResetDefaults}
            className="text-[#787B86] text-sm hover:text-white transition cursor-pointer"
          >
            Reset defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#d1d4dc] bg-[#2a2e39] border border-[#363a45] rounded hover:bg-[#363a45] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-sm text-white bg-[#2962FF] rounded hover:bg-[#1e53e5] transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
