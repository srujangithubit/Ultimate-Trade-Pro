'use client';

import { useCallback } from 'react';
import type { DrawingObject } from '@/lib/drawing/types';

interface DrawingToolbarProps {
  drawing: DrawingObject;
  onOpenSettings: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onStyleChange: (id: string, updates: Partial<DrawingObject>) => void;
}

/** Block pointer/mouse events from leaking into the chart / DrawingLayer */
function stopPointer(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation();
}

export function DrawingToolbar({
  drawing,
  onOpenSettings,
  onDelete,
  onToggleLock,
  onToggleVisibility,
  onStyleChange,
}: DrawingToolbarProps) {
  const isFib = drawing.type === 'fibonacci' || drawing.type === 'fib-trend-ext';

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      const updates: Partial<DrawingObject> = {
        style: { ...drawing.style, color },
      };
      if (isFib && drawing.config) {
        updates.config = { ...drawing.config, trendLineColor: color };
      }
      onStyleChange(drawing.id, updates);
    },
    [drawing, isFib, onStyleChange],
  );

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const lineWidth = Number(e.target.value);
      const updates: Partial<DrawingObject> = {
        style: { ...drawing.style, lineWidth },
      };
      if (isFib) {
        updates.config = { ...(drawing.config ?? {}), levelsLineWidth: lineWidth };
      }
      onStyleChange(drawing.id, updates);
    },
    [drawing, isFib, onStyleChange],
  );

  const handleLineStyleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const lineStyle = e.target.value as 'solid' | 'dashed' | 'dotted';
      const updates: Partial<DrawingObject> = {
        style: { ...drawing.style, lineStyle },
      };
      if (isFib) {
        updates.config = { ...(drawing.config ?? {}), levelsLineStyle: lineStyle };
      }
      onStyleChange(drawing.id, updates);
    },
    [drawing, isFib, onStyleChange],
  );

  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-60 flex items-center gap-0.5 bg-[#1e222d] border border-[#363a45] rounded-lg px-1.5 py-1 shadow-xl select-none"
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
    >
      {/* Lock toggle */}
      <button
        onClick={() => onToggleLock(drawing.id)}
        className={`p-1.5 rounded transition ${drawing.locked ? 'bg-[#2962FF]/20 text-[#2962FF]' : 'text-[#787B86] hover:bg-[#2a2e39] hover:text-white'}`}
        title={drawing.locked ? 'Unlock drawing' : 'Lock drawing'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          {drawing.locked ? (
            <path d="M11 7V5a3 3 0 00-6 0v2H4a1 1 0 00-1 1v5a1 1 0 001 1h8a1 1 0 001-1V8a1 1 0 00-1-1h-1zm-4-2a2 2 0 014 0v2H7V5z"/>
          ) : (
            <path d="M11 7h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h5V5a2 2 0 00-4 0v1H4V5a3 3 0 016 0v2z"/>
          )}
        </svg>
      </button>

      {/* Visibility toggle */}
      <button
        onClick={() => onToggleVisibility(drawing.id)}
        className={`p-1.5 rounded transition ${!drawing.visible ? 'bg-yellow-900/30 text-yellow-400' : 'text-[#787B86] hover:bg-[#2a2e39] hover:text-white'}`}
        title={drawing.visible ? 'Hide drawing' : 'Show drawing'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          {drawing.visible !== false ? (
            <path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5zm0 8a3 3 0 110-6 3 3 0 010 6zm0-5a2 2 0 100 4 2 2 0 000-4z"/>
          ) : (
            <path d="M2.3 2.3a.5.5 0 01.7 0l11 11a.5.5 0 01-.7.7l-2.2-2.2A7.5 7.5 0 011 8c.4-1.3 1.4-2.8 3-3.9L2.3 2.6a.5.5 0 010-.7zM5 5.1A5.5 5.5 0 002 8a6.5 6.5 0 008.5 3.5L9.3 10.3A3 3 0 015.7 6.7L5 5.1zM8 3c-.8 0-1.6.1-2.3.4l.8.8A6.5 6.5 0 0114 8a7.3 7.3 0 01-1.5 2.2l.7.7A8.2 8.2 0 0015 8c-.5-1.6-2-3.5-4.2-4.4A7 7 0 008 3z"/>
          )}
        </svg>
      </button>

      <div className="w-px h-5 bg-[#363a45] mx-1" />

      {/* Color picker */}
      <div className="relative p-1.5 rounded hover:bg-[#2a2e39] transition" title="Color">
        <input
          type="color"
          value={drawing.style.color}
          onChange={handleColorChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-4 h-4 rounded border border-[#363a45]" style={{ backgroundColor: drawing.style.color }} />
      </div>

      {/* Line style */}
      <select
        value={drawing.style.lineStyle}
        onChange={handleLineStyleChange}
        className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-xs rounded px-1 py-1 mx-0.5 cursor-pointer"
        title="Line style"
      >
        <option value="solid">───</option>
        <option value="dashed">- - -</option>
        <option value="dotted">· · ·</option>
      </select>

      {/* Line width */}
      <select
        value={drawing.style.lineWidth}
        onChange={handleWidthChange}
        className="bg-[#2a2e39] border border-[#363a45] text-[#d1d4dc] text-xs rounded px-1 py-1 mx-0.5 cursor-pointer"
        title="Line width"
      >
        <option value={1}>1px</option>
        <option value={2}>2px</option>
        <option value={3}>3px</option>
        <option value={4}>4px</option>
      </select>

      <div className="w-px h-5 bg-[#363a45] mx-1" />

      {/* Settings / gear button */}
      <button
        onClick={() => onOpenSettings(drawing.id)}
        className="p-1.5 rounded hover:bg-[#2a2e39] transition text-[#787B86] hover:text-white"
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm6.3-2.8l-1-.3a5.3 5.3 0 00-.4-1l.5-.9a.5.5 0 00-.1-.6l-.7-.7a.5.5 0 00-.6-.1l-.9.5a5 5 0 00-1-.4l-.3-1a.5.5 0 00-.5-.4h-1a.5.5 0 00-.5.4l-.3 1a5 5 0 00-1 .4l-.9-.5a.5.5 0 00-.6.1l-.7.7a.5.5 0 00-.1.6l.5.9a5 5 0 00-.4 1l-1 .3a.5.5 0 00-.4.5v1a.5.5 0 00.4.5l1 .3a5 5 0 00.4 1l-.5.9a.5.5 0 00.1.6l.7.7a.5.5 0 00.6.1l.9-.5a5 5 0 001 .4l.3 1a.5.5 0 00.5.4h1a.5.5 0 00.5-.4l.3-1a5 5 0 001-.4l.9.5a.5.5 0 00.6-.1l.7-.7a.5.5 0 00.1-.6l-.5-.9a5 5 0 00.4-1l1-.3a.5.5 0 00.4-.5v-1a.5.5 0 00-.4-.5z"/>
        </svg>
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(drawing.id)}
        className="p-1.5 rounded hover:bg-red-900/40 transition text-[#787B86] hover:text-red-400"
        title="Delete drawing"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5.5 1A.5.5 0 016 .5h4a.5.5 0 01.5.5v1h3a.5.5 0 010 1h-.6l-.7 10.1a1.5 1.5 0 01-1.5 1.4H5.3a1.5 1.5 0 01-1.5-1.4L3.1 3.5H2.5a.5.5 0 010-1h3V1zm1 0v1h3V1h-3zM4.1 3.5l.7 10a.5.5 0 00.5.5h5.4a.5.5 0 00.5-.5l.7-10H4.1z"/>
        </svg>
      </button>
    </div>
  );
}
