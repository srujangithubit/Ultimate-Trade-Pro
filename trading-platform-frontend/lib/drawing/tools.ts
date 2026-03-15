/**
 * TradingView-style drawing tool registry — COMPLETE.
 * Every tool from TradingView's toolbar is defined here with metadata,
 * grouped by category exactly as TradingView organises them.
 */

import type { DrawingStyle } from './types';

// ── Tool identifier type ─────────────────────────────────────────────────

export type DrawingToolId =
  // Cursor / selection
  | 'cursor' | 'crosshair' | 'dot'
  // Line tools
  | 'trendline' | 'ray' | 'extended-line' | 'trend-angle' | 'hline'
  | 'hray' | 'vline' | 'cross-line' | 'parallel-channel' | 'info-line'
  // Pitchfork
  | 'pitchfork' | 'schiff-pitchfork' | 'mod-schiff-pitchfork' | 'inside-pitchfork'
  // Gann & Fibonacci
  | 'gann-box' | 'gann-square-fixed' | 'gann-square' | 'gann-fan'
  | 'fibonacci' | 'fib-trend-ext' | 'fib-channel' | 'fib-timezone'
  | 'fib-speed-resistance-fan' | 'trend-fib-time' | 'fib-circle'
  | 'fib-spiral' | 'fib-speed-arcs' | 'fib-wedge' | 'pitchfan'
  // Patterns
  | 'xabcd' | 'cypher' | 'head-shoulders' | 'abcd'
  | 'triangle-pattern' | 'three-drives'
  // Elliott waves
  | 'elliott-impulse' | 'elliott-correction' | 'elliott-triangle'
  | 'elliott-double-combo' | 'elliott-triple-combo'
  // Cycles
  | 'cyclic-lines' | 'time-cycles' | 'sine-line'
  // Forecasting
  | 'long-position' | 'short-position' | 'position-forecast'
  | 'bars-pattern' | 'ghost-feed' | 'sector'
  // Volume-based
  | 'anchored-vwap' | 'fixed-range-vol-profile' | 'anchored-vol-profile'
  // Measurers
  | 'price-range' | 'date-range' | 'date-price-range'
  // Annotation
  | 'text' | 'anchored-text' | 'callout' | 'price-label'
  | 'arrow-marker' | 'arrow' | 'arrow-up' | 'arrow-down'
  | 'flag-mark' | 'note' | 'signpost'
  // Shapes
  | 'rectangle' | 'rotated-rectangle' | 'path' | 'circle' | 'ellipse'
  | 'triangle-shape' | 'polyline' | 'curve' | 'arc' | 'double-curve'
  // Brush
  | 'brush' | 'highlighter'
  // Measure / utility
  | 'measure' | 'eraser' | 'zoom-in' | 'zoom-out'
  | 'magnet' | 'lock' | 'show-hide' | 'trash';

// ── Tool metadata ────────────────────────────────────────────────────────

export interface ToolMeta {
  id: DrawingToolId;
  label: string;
  icon: string;
  clicks: number;
  style: DrawingStyle;
  shortcut?: string;
}

// ── Default styles ───────────────────────────────────────────────────────

const S_LINE: DrawingStyle      = { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' };
const S_DASH: DrawingStyle      = { color: '#787B86', lineWidth: 1, lineStyle: 'dashed' };
const S_FIB: DrawingStyle       = { color: '#787B86', lineWidth: 1, lineStyle: 'dashed' };
const S_SHAPE: DrawingStyle     = { color: '#2196F3', lineWidth: 1, lineStyle: 'solid', fillColor: '#2196F3', fillOpacity: 0.1 };
const S_BUY: DrawingStyle       = { color: '#26A69A', lineWidth: 1, lineStyle: 'solid', fillColor: '#26A69A', fillOpacity: 0.12 };
const S_SELL: DrawingStyle      = { color: '#EF5350', lineWidth: 1, lineStyle: 'solid', fillColor: '#EF5350', fillOpacity: 0.12 };
const S_TEXT: DrawingStyle      = { color: '#D1D4DC', lineWidth: 1, lineStyle: 'solid', fontSize: 14 };
const S_MEASURE: DrawingStyle   = { color: '#D1D4DC', lineWidth: 1, lineStyle: 'dashed' };
const S_BRUSH: DrawingStyle     = { color: '#FF6D00', lineWidth: 3, lineStyle: 'solid' };
const S_CYCLE: DrawingStyle     = { color: '#00BCD4', lineWidth: 1, lineStyle: 'solid' };
const S_VWAP: DrawingStyle      = { color: '#FF9800', lineWidth: 2, lineStyle: 'solid' };
const S_VOL: DrawingStyle       = { color: '#7B1FA2', lineWidth: 1, lineStyle: 'solid', fillColor: '#7B1FA2', fillOpacity: 0.15 };

// ── SVG icon paths (28×28 viewBox) ───────────────────────────────────────
// Each value is either a single path string (stroke-rendered) or
// an array of { d, fill?, stroke? } for mixed stroke/fill icons.
// Redesigned to match TradingView's actual toolbar icons precisely.

export type IconDef = string | { d: string; fill?: boolean; stroke?: boolean; text?: boolean }[];

export const ICONS: Record<string, IconDef> = {
  /* ── Cursor / Selection ────────────────────────────────────────────── */
  cursor: [
    { d: 'M7 2l1 18 4-6 6 0z', fill: true },
  ],
  crosshair:         'M14 3v22M3 14h22M14 9a5 5 0 110 10 5 5 0 010-10z',
  dot: [
    { d: 'M14 10a4 4 0 110 8 4 4 0 010-8z', fill: true },
  ],

  /* ── Line Tools ────────────────────────────────────────────────────── */
  trendline:         'M5 23L23 5',
  ray:               'M5 23L23 5M23 5l-5 0M23 5l0 5',
  'extended-line':   'M1 19L27 9',
  'trend-angle':     'M5 23L23 5M5 23h18M20 23v-14',
  hline:             'M2 14h24',
  hray:              'M3 14h22M25 14l-4-3M25 14l-4 3',
  vline:             'M14 2v24',
  'cross-line':      'M14 2v24M2 14h24',
  'parallel-channel':'M4 19l16-12M8 25l16-12',
  'info-line':       'M5 23L23 5M19 5h4v4M14 14l-2 1M12 15v3',

  /* ── Pitchfork ─────────────────────────────────────────────────────── */
  pitchfork:         'M4 24L14 4l10 20M14 4v22M7 18h14',
  'schiff-pitchfork':'M4 24L14 4l10 20M9 14v12M14 4v22',
  'mod-schiff-pitchfork': 'M4 24l5-10L14 4l10 20M9 14v12M14 4v22',
  'inside-pitchfork':'M4 24L14 4l10 20M14 4v22M8 16h12',

  /* ── Fibonacci ─────────────────────────────────────────────────────── */
  fibonacci: [
    { d: 'M3 4h22M3 9.3h22M3 14h22M3 18.7h22M3 24h22', stroke: true },
    { d: 'M4 6.5h3v-1.5h-3v1.5z M4 12h3v-1.5h-3v1.5z', fill: true, text: true },
  ],
  'fib-trend-ext': [
    { d: 'M3 4h22M3 10h22M3 16h22M3 24h22M6 20l5-12 4 7', stroke: true },
    { d: 'M4 6.5h3v-1.5h-3v1.5z', fill: true, text: true },
  ],
  'fib-channel':     'M4 20l16-12M4 26l16-12M4 14l16-12',
  'fib-timezone':    'M5 3v22M10 3v22M17 3v22M24 3v22',
  'fib-speed-resistance-fan': 'M3 25L25 3M3 25l22-8M3 25l22-14M3 25l12-22',
  'trend-fib-time': [
    { d: 'M5 3v22M10 3v22M17 3v22M7 20l5-12 4 7', stroke: true },
  ],
  'fib-circle':      'M14 14m-10 0a10 10 0 1120 0 10 10 0 01-20 0M14 14m-6.5 0a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0M14 14m-3 0a3 3 0 116 0 3 3 0 01-6 0',
  'fib-spiral':      'M14 14a3 3 0 016 0 5 5 0 01-10 0 8 8 0 0116 0 12 12 0 01-24 0',
  'fib-speed-arcs':  'M5 23L23 5M5 23q12 0 17-9M5 23q7 0 10-6M5 23q3 0 5-3',
  'fib-wedge':       'M5 24L14 4l9 20M9 14l5-10 5 10',
  pitchfan:          'M3 25L14 4M3 25l16-16M3 25l20-14M3 25h22',

  /* ── Gann ──────────────────────────────────────────────────────────── */
  'gann-box':        'M3 3h22v22H3zM3 3l22 22M25 3L3 25M3 14h22M14 3v22',
  'gann-square-fixed': [
    { d: 'M3 3h22v22H3zM3 3l22 22M25 3L3 25M14 3v22M3 14h22', stroke: true },
    { d: 'M13 13h2v2h-2z', fill: true },
  ],
  'gann-square':     'M3 3h22v22H3zM3 3l22 22M25 3L3 25',
  'gann-fan':        'M3 25L25 3M3 25l22-10M3 25h22M3 25l10-22',

  /* ── Chart Patterns (with dots at vertices) ────────────────────────── */
  xabcd: [
    { d: 'M3 17L7 6l6 14 6-14 5 11', stroke: true },
    { d: 'M3 17a1.5 1.5 0 110 .01M7 6a1.5 1.5 0 110 .01M13 20a1.5 1.5 0 110 .01M19 6a1.5 1.5 0 110 .01M24 17a1.5 1.5 0 110 .01', fill: true },
  ],
  cypher: [
    { d: 'M3 20L9 4l4 16 6-12 4 8', stroke: true },
    { d: 'M3 20a1.5 1.5 0 110 .01M9 4a1.5 1.5 0 110 .01M13 20a1.5 1.5 0 110 .01M19 8a1.5 1.5 0 110 .01M23 16a1.5 1.5 0 110 .01', fill: true },
  ],
  'head-shoulders': [
    { d: 'M2 20l4-8 4 8 4-16 4 16 4-8 4 8', stroke: true },
    { d: 'M2 20a1.3 1.3 0 110 .01M6 12a1.3 1.3 0 110 .01M10 20a1.3 1.3 0 110 .01M14 4a1.3 1.3 0 110 .01M18 20a1.3 1.3 0 110 .01M22 12a1.3 1.3 0 110 .01M26 20a1.3 1.3 0 110 .01', fill: true },
  ],
  abcd: [
    { d: 'M4 18L10 6l6 12 6-12', stroke: true },
    { d: 'M4 18a1.5 1.5 0 110 .01M10 6a1.5 1.5 0 110 .01M16 18a1.5 1.5 0 110 .01M22 6a1.5 1.5 0 110 .01', fill: true },
  ],
  'triangle-pattern': [
    { d: 'M3 22L14 6l11 16H3z', stroke: true },
    { d: 'M3 22a1.5 1.5 0 110 .01M14 6a1.5 1.5 0 110 .01M25 22a1.5 1.5 0 110 .01', fill: true },
  ],
  'three-drives': [
    { d: 'M3 22l4-14 4 14 4-14 4 14 3-8', stroke: true },
    { d: 'M3 22a1.3 1.3 0 110 .01M7 8a1.3 1.3 0 110 .01M11 22a1.3 1.3 0 110 .01M15 8a1.3 1.3 0 110 .01M19 22a1.3 1.3 0 110 .01M22 14a1.3 1.3 0 110 .01', fill: true },
  ],

  /* ── Elliott Waves (small text labels + zigzag) ────────────────────── */
  'elliott-impulse': [
    { d: 'M3 24l3-18 3 12 4-16 3 9 5-10 3 20', stroke: true },
    { d: 'M5 4h4v3h-4z', fill: true, text: true },
    { d: 'M19 3h4v3h-4z', fill: true, text: true },
  ],
  'elliott-correction': [
    { d: 'M5 6l6 18-5-12 7 14', stroke: true },
    { d: 'M3 3h4v3h-4z', fill: true, text: true },
    { d: 'M12 3h4v3h-4z', fill: true, text: true },
  ],
  'elliott-triangle': [
    { d: 'M3 18l6-12 6 9 6-6 3 3', stroke: true },
    { d: 'M2 3h4v3h-4z', fill: true, text: true },
    { d: 'M18 3h4v3h-4z', fill: true, text: true },
  ],
  'elliott-double-combo': [
    { d: 'M3 20l4-14 3 12 4-12 3 9 4-9 3 14', stroke: true },
    { d: 'M3 3h4v3h-4z', fill: true, text: true },
    { d: 'M17 3h4v3h-4z', fill: true, text: true },
  ],
  'elliott-triple-combo': [
    { d: 'M2 20l3-12 3 9 3-9 3 6 3-6 3 9 3-12 3 14', stroke: true },
    { d: 'M2 3h4v3h-4z', fill: true, text: true },
    { d: 'M19 3h4v3h-4z', fill: true, text: true },
  ],

  /* ── Cycles ────────────────────────────────────────────────────────── */
  'cyclic-lines':    'M5 3v22M11 3v22M17 3v22M23 3v22',
  'time-cycles':     'M3 22a11 11 0 0122 0M14 22a5.5 5.5 0 0111 0M3 22a5.5 5.5 0 0111 0',
  'sine-line':       'M2 14c4-12 8 12 12 0s8-12 12 0',

  /* ── Forecasting ───────────────────────────────────────────────────── */
  'long-position': [
    { d: 'M7 24h14M7 4h14M7 4v20M21 4v20', stroke: true },
    { d: 'M14 22v-12M11 13l3-4 3 4', stroke: true },
    { d: 'M7 4h14v6H7z', fill: true, text: true },
  ],
  'short-position': [
    { d: 'M7 4h14M7 24h14M7 4v20M21 4v20', stroke: true },
    { d: 'M14 6v12M11 15l3 4 3-4', stroke: true },
    { d: 'M7 18h14v6H7z', fill: true, text: true },
  ],
  'position-forecast': 'M5 20l5-12 5 6 5-10M5 20h20M25 4v16',
  'bars-pattern':    'M7 12v10M11 7v15M15 10v12M19 5v17M23 8v14',
  'ghost-feed': [
    { d: 'M4 20l4-9 4 6 4-12 4 9', stroke: true },
    { d: 'M5 22l4-6 4 3 4-8 4 5', stroke: true },
  ],
  sector:            'M5 24Q5 4 24 4L5 24z',

  /* ── Volume-Based ──────────────────────────────────────────────────── */
  'anchored-vwap': [
    { d: 'M3 20l5-6 5 3 5-9 5 6', stroke: true },
    { d: 'M7 5l-3 3M7 5l3 3', stroke: true },
    { d: 'M3 11h22', stroke: true },
  ],
  'fixed-range-vol-profile': [
    { d: 'M5 3v22M24 3v22', stroke: true },
    { d: 'M5 6h8M5 9h14M5 12h6M5 15h11M5 18h9M5 21h13', stroke: true },
  ],
  'anchored-vol-profile': [
    { d: 'M8 3v22', stroke: true },
    { d: 'M8 6h7M8 9h12M8 12h5M8 15h9M8 18h7M8 21h10', stroke: true },
    { d: 'M8 2l-3 3M8 2l3 3', stroke: true },
  ],

  /* ── Measurers ─────────────────────────────────────────────────────── */
  'price-range':     'M5 6h18M5 22h18M14 6v16M14 9l-3-3M14 9l3-3M14 19l-3 3M14 19l3 3',
  'date-range':      'M6 5v18M22 5v18M6 14h16M9 14l-3-3M9 14l-3 3M19 14l3-3M19 14l3 3',
  'date-price-range':'M5 6h18M5 22h18M6 5v18M22 5v18',

  /* ── Annotation ────────────────────────────────────────────────────── */
  text: [
    { d: 'M6 5h16M14 5v18', stroke: true },
    { d: 'M9 5v3M19 5v3', stroke: true },
  ],
  'anchored-text':   'M6 4h16M14 4v18M14 22l-3 3M14 22l3 3M9 4v3M19 4v3',
  callout:           'M4 4h20v14H14l-4 4v-4H4V4z',
  'price-label':     'M20 4H8l-4 9 4 9h12l4-9-4-9z',
  note:              'M4 4h20v20H4V4zM9 10h10M9 15h6',
  signpost:          'M14 2v24M8 5h12l-3 5 3 5H8',

  /* ── Arrows (new section matching TradingView) ─────────────────────── */
  'arrow-marker': [
    { d: 'M14 24V8', stroke: true },
    { d: 'M14 4l-6 6h12z', fill: true },
  ],
  arrow:             'M6 22L22 6M22 6h-8M22 6v8',
  'arrow-up': [
    { d: 'M14 4l-8 12h16z', fill: true },
  ],
  'arrow-down': [
    { d: 'M14 24l-8-12h16z', fill: true },
  ],
  'flag-mark': [
    { d: 'M6 2v24', stroke: true },
    { d: 'M6 3h14l-4 5 4 5H6z', fill: true },
  ],

  /* ── Shapes ────────────────────────────────────────────────────────── */
  rectangle:         'M3 7h22v14H3V7z',
  'rotated-rectangle': 'M14 3l11 11-11 11L3 14 14 3z',
  path: [
    { d: 'M3 20l6-12 7 7 8-12', stroke: true },
    { d: 'M3 20a2 2 0 110 .01M9 8a2 2 0 110 .01M16 15a2 2 0 110 .01M24 3a2 2 0 110 .01', fill: true },
  ],
  circle:            'M14 3a11 11 0 110 22 11 11 0 010-22z',
  ellipse:           'M14 7c6 0 11 3 11 7s-5 7-11 7S3 18 3 14s5-7 11-7z',
  polyline: [
    { d: 'M3 20l6-12 6 7 4-9 5 14', stroke: true },
    { d: 'M3 20a1.8 1.8 0 110 .01M9 8a1.8 1.8 0 110 .01M15 15a1.8 1.8 0 110 .01M19 6a1.8 1.8 0 110 .01M24 20a1.8 1.8 0 110 .01', fill: true },
  ],
  'triangle-shape':  'M14 4L3 24h22L14 4z',
  arc:               'M3 20Q14 2 25 20',
  curve:             'M3 20Q9 2 14 14t11-6',
  'double-curve':    'M3 20Q9 4 14 14Q19 24 25 8',

  /* ── Brush ──────────────────────────────────────────────────────────── */
  brush: [
    { d: 'M20 3l-3 3 5 5 3-3-5-5z', fill: true },
    { d: 'M17 6L8 15l-2 6 6-2 9-9-4-4z', stroke: true },
  ],
  highlighter: [
    { d: 'M5 13h18v5H5z', fill: true },
    { d: 'M5 13h18v5H5z', stroke: true },
  ],

  /* ── Utility / Measure ─────────────────────────────────────────────── */
  measure:           'M5 5v18M23 5v18M5 14h18M5 14l3-3M5 14l3 3M23 14l-3-3M23 14l-3 3',
  eraser:            'M11 4l12 12-6 6H9l-3-3L11 4z',
  'zoom-in':         'M12 4a8 8 0 110 16 8 8 0 010-16zM18 18l6 6M12 9v6M9 12h6',
  'zoom-out':        'M12 4a8 8 0 110 16 8 8 0 010-16zM18 18l6 6M9 12h6',
  magnet:            'M8 14V8a6 6 0 0112 0v6M8 14h3M17 14h3M11 14v6M17 14v6',
  lock:              'M8 14V10a6 6 0 0112 0v4M6 14h16v10H6V14z',
  'show-hide':       'M2 14s4-9 12-9 12 9 12 9-4 9-12 9-12-9-12-9zM14 11a3 3 0 110 6 3 3 0 010-6z',
  trash:             'M6 7h16M10 7V5h8v2M8 7v15h12V7',
};

// ── Tool registry ────────────────────────────────────────────────────────

export const TOOLS: Record<DrawingToolId, ToolMeta> = {
  cursor:              { id: 'cursor',              label: 'Cursor',                icon: 'cursor',              clicks: 0, style: S_LINE,      shortcut: 'V' },
  crosshair:           { id: 'crosshair',           label: 'Crosshair',             icon: 'crosshair',           clicks: 0, style: S_LINE,      shortcut: 'C' },
  dot:                 { id: 'dot',                 label: 'Dot',                   icon: 'dot',                 clicks: 0, style: S_LINE },
  trendline:           { id: 'trendline',           label: 'Trend Line',            icon: 'trendline',           clicks: 2, style: S_LINE,      shortcut: 'T' },
  ray:                 { id: 'ray',                 label: 'Ray',                   icon: 'ray',                 clicks: 2, style: S_LINE,      shortcut: 'R' },
  'extended-line':     { id: 'extended-line',       label: 'Extended Line',         icon: 'extended-line',       clicks: 2, style: S_LINE },
  'trend-angle':       { id: 'trend-angle',         label: 'Trend Angle',           icon: 'trend-angle',         clicks: 2, style: S_LINE },
  hline:               { id: 'hline',               label: 'Horizontal Line',       icon: 'hline',               clicks: 1, style: S_DASH,      shortcut: 'H' },
  hray:                { id: 'hray',                label: 'Horizontal Ray',        icon: 'hray',                clicks: 2, style: S_LINE },
  vline:               { id: 'vline',               label: 'Vertical Line',         icon: 'vline',               clicks: 1, style: S_DASH },
  'cross-line':        { id: 'cross-line',          label: 'Cross Line',            icon: 'cross-line',          clicks: 1, style: S_DASH },
  'parallel-channel':  { id: 'parallel-channel',    label: 'Parallel Channel',      icon: 'parallel-channel',    clicks: 3, style: { ...S_LINE, fillColor: '#2962FF', fillOpacity: 0.05 } },
  'info-line':         { id: 'info-line',           label: 'Info Line',             icon: 'info-line',           clicks: 2, style: S_LINE },
  pitchfork:           { id: 'pitchfork',           label: 'Pitchfork',             icon: 'pitchfork',           clicks: 3, style: S_LINE },
  'schiff-pitchfork':  { id: 'schiff-pitchfork',    label: 'Schiff Pitchfork',      icon: 'schiff-pitchfork',    clicks: 3, style: S_LINE },
  'mod-schiff-pitchfork': { id: 'mod-schiff-pitchfork', label: 'Modified Schiff',   icon: 'mod-schiff-pitchfork', clicks: 3, style: S_LINE },
  'inside-pitchfork':  { id: 'inside-pitchfork',    label: 'Inside Pitchfork',      icon: 'inside-pitchfork',    clicks: 3, style: S_LINE },
  'gann-box':          { id: 'gann-box',            label: 'Gann Box',              icon: 'gann-box',            clicks: 2, style: S_SHAPE },
  'gann-square-fixed': { id: 'gann-square-fixed',   label: 'Gann Square Fixed',     icon: 'gann-square-fixed',   clicks: 2, style: S_SHAPE },
  'gann-square':       { id: 'gann-square',         label: 'Gann Square',           icon: 'gann-square',         clicks: 2, style: S_SHAPE },
  'gann-fan':          { id: 'gann-fan',            label: 'Gann Fan',              icon: 'gann-fan',            clicks: 2, style: S_LINE },
  fibonacci:           { id: 'fibonacci',           label: 'Fib Retracement',       icon: 'fibonacci',           clicks: 2, style: S_FIB,       shortcut: 'Alt + F' },
  'fib-trend-ext':     { id: 'fib-trend-ext',       label: 'Trend-Based Fib Extension', icon: 'fib-trend-ext',   clicks: 3, style: S_FIB },
  'fib-channel':       { id: 'fib-channel',         label: 'Fib Channel',           icon: 'fib-channel',         clicks: 3, style: S_FIB },
  'fib-timezone':      { id: 'fib-timezone',        label: 'Fib Time Zone',         icon: 'fib-timezone',        clicks: 2, style: S_FIB },
  'fib-speed-resistance-fan': { id: 'fib-speed-resistance-fan', label: 'Fib Speed Resistance Fan', icon: 'fib-speed-resistance-fan', clicks: 2, style: S_FIB },
  'trend-fib-time':    { id: 'trend-fib-time',      label: 'Trend-Based Fib Time',  icon: 'trend-fib-time',      clicks: 3, style: S_FIB },
  'fib-circle':        { id: 'fib-circle',          label: 'Fib Circles',           icon: 'fib-circle',          clicks: 2, style: S_FIB },
  'fib-spiral':        { id: 'fib-spiral',          label: 'Fib Spiral',            icon: 'fib-spiral',          clicks: 2, style: S_FIB },
  'fib-speed-arcs':    { id: 'fib-speed-arcs',      label: 'Fib Speed Resistance Arcs', icon: 'fib-speed-arcs', clicks: 2, style: S_FIB },
  'fib-wedge':         { id: 'fib-wedge',           label: 'Fib Wedge',             icon: 'fib-wedge',           clicks: 3, style: S_FIB },
  pitchfan:            { id: 'pitchfan',            label: 'Pitchfan',              icon: 'pitchfan',            clicks: 3, style: S_FIB },
  xabcd:               { id: 'xabcd',               label: 'XABCD Pattern',         icon: 'xabcd',               clicks: 5, style: S_LINE },
  cypher:              { id: 'cypher',              label: 'Cypher Pattern',        icon: 'cypher',              clicks: 5, style: S_LINE },
  'head-shoulders':    { id: 'head-shoulders',      label: 'Head and Shoulders',    icon: 'head-shoulders',      clicks: 7, style: S_LINE },
  abcd:                { id: 'abcd',                label: 'ABCD Pattern',          icon: 'abcd',                clicks: 4, style: S_LINE },
  'triangle-pattern':  { id: 'triangle-pattern',    label: 'Triangle Pattern',      icon: 'triangle-pattern',    clicks: 3, style: S_LINE },
  'three-drives':      { id: 'three-drives',        label: 'Three Drives',          icon: 'three-drives',        clicks: 7, style: S_LINE },
  'elliott-impulse':   { id: 'elliott-impulse',     label: 'Elliott Impulse Wave (1·2·3·4·5)', icon: 'elliott-impulse', clicks: 6, style: S_LINE },
  'elliott-correction':{ id: 'elliott-correction',  label: 'Elliott Correction Wave (A·B·C)', icon: 'elliott-correction', clicks: 4, style: S_LINE },
  'elliott-triangle':  { id: 'elliott-triangle',    label: 'Elliott Triangle Wave (A·B·C·D·E)', icon: 'elliott-triangle', clicks: 6, style: S_LINE },
  'elliott-double-combo': { id: 'elliott-double-combo', label: 'Elliott Double Combo (W·X·Y)', icon: 'elliott-double-combo', clicks: 4, style: S_LINE },
  'elliott-triple-combo': { id: 'elliott-triple-combo', label: 'Elliott Triple Combo (W·X·Y·X·Z)', icon: 'elliott-triple-combo', clicks: 6, style: S_LINE },
  'cyclic-lines':      { id: 'cyclic-lines',        label: 'Cyclic Lines',          icon: 'cyclic-lines',        clicks: 2, style: S_CYCLE },
  'time-cycles':       { id: 'time-cycles',         label: 'Time Cycles',           icon: 'time-cycles',         clicks: 2, style: S_CYCLE },
  'sine-line':         { id: 'sine-line',           label: 'Sine Line',             icon: 'sine-line',           clicks: 2, style: S_CYCLE },
  'long-position':     { id: 'long-position',       label: 'Long Position',         icon: 'long-position',       clicks: 3, style: S_BUY,       shortcut: 'L' },
  'short-position':    { id: 'short-position',      label: 'Short Position',        icon: 'short-position',      clicks: 3, style: S_SELL,      shortcut: 'S' },
  'position-forecast': { id: 'position-forecast',   label: 'Position Forecast',     icon: 'position-forecast',   clicks: 3, style: S_LINE },
  'bars-pattern':      { id: 'bars-pattern',        label: 'Bar Pattern',           icon: 'bars-pattern',        clicks: 2, style: S_LINE },
  'ghost-feed':        { id: 'ghost-feed',          label: 'Ghost Feed',            icon: 'ghost-feed',          clicks: 2, style: { ...S_LINE, color: '#787B86' } },
  sector:              { id: 'sector',              label: 'Sector',                icon: 'sector',              clicks: 2, style: S_SHAPE },
  'anchored-vwap':     { id: 'anchored-vwap',       label: 'Anchored VWAP',         icon: 'anchored-vwap',       clicks: 1, style: S_VWAP },
  'fixed-range-vol-profile': { id: 'fixed-range-vol-profile', label: 'Fixed Range Volume Profile', icon: 'fixed-range-vol-profile', clicks: 2, style: S_VOL },
  'anchored-vol-profile': { id: 'anchored-vol-profile', label: 'Anchored Volume Profile', icon: 'anchored-vol-profile', clicks: 1, style: S_VOL },
  'price-range':       { id: 'price-range',         label: 'Price Range',           icon: 'price-range',         clicks: 2, style: S_SHAPE },
  'date-range':        { id: 'date-range',          label: 'Date Range',            icon: 'date-range',          clicks: 2, style: S_SHAPE },
  'date-price-range':  { id: 'date-price-range',    label: 'Date and Price Range',  icon: 'date-price-range',    clicks: 2, style: S_SHAPE },
  text:                { id: 'text',                label: 'Text',                  icon: 'text',                clicks: 1, style: S_TEXT,       shortcut: 'A' },
  'anchored-text':     { id: 'anchored-text',       label: 'Anchored Text',         icon: 'anchored-text',       clicks: 1, style: S_TEXT },
  callout:             { id: 'callout',             label: 'Callout',               icon: 'callout',             clicks: 2, style: { ...S_TEXT, fillColor: '#2962FF', fillOpacity: 0.08 } },
  'price-label':       { id: 'price-label',         label: 'Price Label',           icon: 'price-label',         clicks: 1, style: S_TEXT },
  'arrow-marker':      { id: 'arrow-marker',        label: 'Arrow Marker',          icon: 'arrow-marker',        clicks: 1, style: { ...S_LINE, color: '#26A69A' } },
  arrow:               { id: 'arrow',               label: 'Arrow',                 icon: 'arrow',               clicks: 2, style: S_LINE },
  'arrow-up':          { id: 'arrow-up',             label: 'Arrow Mark Up',         icon: 'arrow-up',            clicks: 1, style: { ...S_LINE, color: '#26A69A' } },
  'arrow-down':        { id: 'arrow-down',           label: 'Arrow Mark Down',       icon: 'arrow-down',          clicks: 1, style: { ...S_LINE, color: '#EF5350' } },
  'flag-mark':         { id: 'flag-mark',           label: 'Flag',                  icon: 'flag-mark',           clicks: 1, style: { ...S_LINE, color: '#EF5350' } },
  note:                { id: 'note',                label: 'Note',                  icon: 'note',                clicks: 1, style: S_TEXT },
  signpost:            { id: 'signpost',            label: 'Signpost',              icon: 'signpost',            clicks: 1, style: S_LINE },
  rectangle:           { id: 'rectangle',           label: 'Rectangle',             icon: 'rectangle',           clicks: 2, style: S_SHAPE,     shortcut: 'Alt + Shift + R' },
  'rotated-rectangle': { id: 'rotated-rectangle',   label: 'Rotated Rectangle',     icon: 'rotated-rectangle',   clicks: 3, style: S_SHAPE },
  path:                { id: 'path',                label: 'Path',                  icon: 'path',                clicks: 99, style: S_LINE },
  circle:              { id: 'circle',              label: 'Circle',                icon: 'circle',              clicks: 2, style: S_SHAPE },
  ellipse:             { id: 'ellipse',             label: 'Ellipse',               icon: 'ellipse',             clicks: 2, style: S_SHAPE },
  'triangle-shape':    { id: 'triangle-shape',      label: 'Triangle',              icon: 'triangle-shape',      clicks: 3, style: S_SHAPE },
  polyline:            { id: 'polyline',            label: 'Polyline',              icon: 'polyline',            clicks: 99, style: S_LINE },
  curve:               { id: 'curve',               label: 'Curve',                 icon: 'curve',               clicks: 3, style: S_LINE },
  arc:                 { id: 'arc',                 label: 'Arc',                   icon: 'arc',                 clicks: 3, style: S_LINE },
  'double-curve':      { id: 'double-curve',        label: 'Double Curve',          icon: 'double-curve',        clicks: 3, style: S_LINE },
  brush:               { id: 'brush',               label: 'Brush',                 icon: 'brush',               clicks: -1, style: S_BRUSH },
  highlighter:         { id: 'highlighter',         label: 'Highlighter',           icon: 'highlighter',         clicks: -1, style: { ...S_BRUSH, color: '#FFEB3B', lineWidth: 12, fillOpacity: 0.3 } },
  measure:             { id: 'measure',             label: 'Measure',               icon: 'measure',             clicks: 2, style: S_MEASURE,   shortcut: 'M' },
  eraser:              { id: 'eraser',              label: 'Remove Last',           icon: 'eraser',              clicks: 0, style: S_LINE },
  'zoom-in':           { id: 'zoom-in',             label: 'Zoom In',               icon: 'zoom-in',             clicks: 0, style: S_LINE },
  'zoom-out':          { id: 'zoom-out',            label: 'Zoom Out',              icon: 'zoom-out',            clicks: 0, style: S_LINE },
  magnet:              { id: 'magnet',              label: 'Magnet Mode',           icon: 'magnet',              clicks: 0, style: S_LINE },
  lock:                { id: 'lock',                label: 'Lock Drawings',         icon: 'lock',                clicks: 0, style: S_LINE },
  'show-hide':         { id: 'show-hide',           label: 'Show/Hide All',         icon: 'show-hide',           clicks: 0, style: S_LINE },
  trash:               { id: 'trash',               label: 'Delete All',            icon: 'trash',               clicks: 0, style: S_LINE },
};

// ── Toolbar category groups (matching TradingView sidebar exactly) ────────

export interface ToolGroupDef {
  id: string;
  label: string;
  tools: DrawingToolId[];
  sections?: { label: string; start: number }[];
}

export const TOOL_GROUPS: ToolGroupDef[] = [
  {
    id: 'cursor-group',
    label: 'Cursor Tools',
    tools: ['cursor', 'crosshair', 'dot'],
  },
  {
    id: 'lines-group',
    label: 'Line Tools',
    tools: ['trendline', 'ray', 'info-line', 'extended-line', 'trend-angle', 'hline', 'hray', 'vline', 'cross-line', 'parallel-channel'],
  },
  {
    id: 'forks-group',
    label: 'Pitchfork Tools',
    tools: ['pitchfork', 'schiff-pitchfork', 'mod-schiff-pitchfork', 'inside-pitchfork'],
  },
  {
    id: 'fib-gann-group',
    label: 'Fibonacci & Gann',
    tools: [
      'fibonacci', 'fib-trend-ext', 'fib-channel', 'fib-timezone',
      'fib-speed-resistance-fan', 'trend-fib-time', 'fib-circle',
      'fib-spiral', 'fib-speed-arcs', 'fib-wedge', 'pitchfan',
      'gann-box', 'gann-square-fixed', 'gann-square', 'gann-fan',
    ],
    sections: [
      { label: 'FIBONACCI', start: 0 },
      { label: 'GANN', start: 11 },
    ],
  },
  {
    id: 'patterns-group',
    label: 'Patterns',
    tools: [
      'xabcd', 'cypher', 'head-shoulders', 'abcd', 'triangle-pattern', 'three-drives',
      'elliott-impulse', 'elliott-correction', 'elliott-triangle',
      'elliott-double-combo', 'elliott-triple-combo',
      'cyclic-lines', 'time-cycles', 'sine-line',
    ],
    sections: [
      { label: 'CHART PATTERNS', start: 0 },
      { label: 'ELLIOTT WAVES', start: 6 },
      { label: 'CYCLES', start: 11 },
    ],
  },
  {
    id: 'forecast-group',
    label: 'Forecasting',
    tools: [
      'long-position', 'short-position', 'position-forecast',
      'bars-pattern', 'ghost-feed', 'sector',
      'anchored-vwap', 'fixed-range-vol-profile', 'anchored-vol-profile',
      'price-range', 'date-range', 'date-price-range',
    ],
    sections: [
      { label: 'FORECASTING', start: 0 },
      { label: 'VOLUME-BASED', start: 6 },
      { label: 'MEASURERS', start: 9 },
    ],
  },
  {
    id: 'annotation-group',
    label: 'Annotation Tools',
    tools: ['text', 'anchored-text', 'callout', 'price-label', 'flag-mark', 'note', 'signpost'],
  },
  {
    id: 'arrows-group',
    label: 'Arrows & Shapes',
    tools: [
      'brush', 'highlighter',
      'arrow-marker', 'arrow', 'arrow-up', 'arrow-down',
      'rectangle', 'rotated-rectangle', 'path', 'circle', 'ellipse',
      'polyline', 'triangle-shape', 'arc', 'curve', 'double-curve',
    ],
    sections: [
      { label: 'BRUSHES', start: 0 },
      { label: 'ARROWS', start: 2 },
      { label: 'SHAPES', start: 6 },
    ],
  },
  {
    id: 'measure-group',
    label: 'Measure',
    tools: ['measure'],
  },
];

export const ACTION_TOOLS: DrawingToolId[] = [
  'zoom-in', 'zoom-out', 'magnet', 'eraser', 'lock', 'show-hide', 'trash',
];

export const NON_DRAWING_IDS = new Set<DrawingToolId>([
  'cursor', 'crosshair', 'dot',
  'trash', 'eraser', 'lock', 'show-hide', 'zoom-in', 'zoom-out', 'magnet',
]);

export const SHORTCUT_MAP: Record<string, DrawingToolId> = {};
for (const [id, meta] of Object.entries(TOOLS)) {
  if (meta.shortcut) {
    SHORTCUT_MAP[meta.shortcut.toLowerCase()] = id as DrawingToolId;
  }
}
