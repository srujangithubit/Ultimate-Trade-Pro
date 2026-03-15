/**
 * Comprehensive TradingView-style canvas renderers.
 * Every drawing tool type has a dedicated renderer function.
 */
import { DrawingObject, DrawingStyle } from './types';
import { extendLine, extendRay, dist, toDeg, angle, lerp, mid } from './geometry';

type PriceToY = (price: number) => number | null;
type PointToXY = (time: number, price: number) => { x: number; y: number } | null;

// ── Shared helpers ───────────────────────────────────────────────────────

function applyStroke(ctx: CanvasRenderingContext2D, s: DrawingStyle) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  if (s.lineStyle === 'dashed') ctx.setLineDash([8, 4]);
  else if (s.lineStyle === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);
}

function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffffcc';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

function pfmt(price: number): string {
  return price > 10 ? price.toFixed(2) : price.toFixed(5);
}

function pill(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  bg: string, fg = '#ffffff',
) {
  ctx.font = '11px "SF Mono",Monaco,Consolas,monospace';
  const tw = ctx.measureText(text).width;
  const pad = 6;
  const lx = x - tw / 2 - pad;
  ctx.beginPath();
  roundRect(ctx, lx, y - 10, tw + pad * 2, 20, 3);
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pts2(d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 2) return null;
  const a = toXY(d.points[0].time, d.points[0].price);
  const b = toXY(d.points[1].time, d.points[1].price);
  if (!a || !b) return null;
  return { a, b };
}

function pts3(d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return null;
  const a = toXY(d.points[0].time, d.points[0].price);
  const b = toXY(d.points[1].time, d.points[1].price);
  const c = toXY(d.points[2].time, d.points[2].price);
  if (!a || !b || !c) return null;
  return { a, b, c };
}

// ────────────────────────────────────────────────────────────────────────
// LINE TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderHLine(ctx: CanvasRenderingContext2D, d: DrawingObject, priceToY: PriceToY, w: number) {
  if (!d.points[0]) return;
  const y = priceToY(d.points[0].price);
  if (y === null) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  pill(ctx, d.text || pfmt(d.points[0].price), w - 65, y, d.style.color);
}

function renderVLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, h: number) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price);
  if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
}

function renderCrossLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, priceToY: PriceToY, w: number, h: number) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price);
  const y = priceToY(d.points[0].price);
  if (!p || y === null) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
  pill(ctx, pfmt(d.points[0].price), w - 65, y, d.style.color);
}

function renderTrendLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderRay(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const [ex, ey] = extendRay(p.a.x, p.a.y, p.b.x, p.b.y, w, h);
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(ex, ey); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
}

function renderHRay(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, priceToY: PriceToY, w: number) {
  const p = pts2(d, toXY); if (!p) return;
  const y = priceToY(d.points[0].price);
  if (y === null) return;
  const direction = p.b.x > p.a.x ? w : 0;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, y); ctx.lineTo(direction, y); ctx.stroke();
  drawAnchor(ctx, p.a.x, y, d.style.color);
}

function renderExtendedLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const [ex1, ey1, ex2, ey2] = extendLine(p.a.x, p.a.y, p.b.x, p.b.y, w, h);
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(ex1, ey1); ctx.lineTo(ex2, ey2); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderTrendAngle(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.a.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.b.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.setLineDash([]);
  const a = angle(p.a.x, p.a.y, p.b.x, p.b.y);
  const r = Math.min(40, dist(p.a.x, p.a.y, p.b.x, p.b.y) * 0.3);
  ctx.beginPath(); ctx.arc(p.a.x, p.a.y, r, 0, a, a < 0); ctx.stroke();
  const deg = Math.abs(toDeg(a));
  ctx.font = '11px "SF Mono",Monaco,Consolas,monospace';
  ctx.fillStyle = d.style.color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${deg.toFixed(1)}°`, p.a.x + r + 4, p.a.y - 4);
  const diff = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? ((diff / d.points[0].price) * 100).toFixed(2) : '0.00';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`${diff >= 0 ? '+' : ''}${pfmt(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`, (p.a.x + p.b.x) / 2, Math.min(p.a.y, p.b.y) - 18);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderInfoLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  const diff = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? ((diff / d.points[0].price) * 100).toFixed(2) : '0.00';
  const label = `${diff >= 0 ? '+' : ''}${pfmt(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`;
  pill(ctx, label, (p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2 - 14, d.style.color);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderParallelChannel(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  const offsetY = p.c.y - p.a.y;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y + offsetY); ctx.lineTo(p.b.x, p.b.y + offsetY); ctx.stroke();
  ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y + offsetY / 2); ctx.lineTo(p.b.x, p.b.y + offsetY / 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (d.style.fillColor) {
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y);
    ctx.lineTo(p.b.x, p.b.y + offsetY); ctx.lineTo(p.a.x, p.a.y + offsetY);
    ctx.closePath();
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.05;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// PITCHFORK TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderPitchfork(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number, variant: 'normal' | 'schiff' | 'mod-schiff' | 'inside') {
  const p = pts3(d, toXY); if (!p) return;
  let origin: { x: number; y: number };
  if (variant === 'schiff') origin = { x: p.a.x, y: (p.a.y + p.b.y) / 2 };
  else if (variant === 'mod-schiff') origin = { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 };
  else if (variant === 'inside') origin = { x: (p.b.x + p.c.x) / 2, y: (p.b.y + p.c.y) / 2 };
  else origin = p.a;
  const [mx, my] = mid(p.b.x, p.b.y, p.c.x, p.c.y);
  applyStroke(ctx, d.style);
  const [rex, rey] = extendRay(origin.x, origin.y, mx, my, w, h);
  ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(rex, rey); ctx.stroke();
  const [ubx, uby] = extendRay(p.b.x, p.b.y, p.b.x + (rex - mx), p.b.y + (rey - my), w, h);
  ctx.beginPath(); ctx.moveTo(p.b.x, p.b.y); ctx.lineTo(ubx, uby); ctx.stroke();
  const [lbx, lby] = extendRay(p.c.x, p.c.y, p.c.x + (rex - mx), p.c.y + (rey - my), w, h);
  ctx.beginPath(); ctx.moveTo(p.c.x, p.c.y); ctx.lineTo(lbx, lby); ctx.stroke();
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.stroke();
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// GANN TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderGannBox(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const x1 = Math.min(p.a.x, p.b.x), y1 = Math.min(p.a.y, p.b.y);
  const x2 = Math.max(p.a.x, p.b.x), y2 = Math.max(p.a.y, p.b.y);
  const bw = x2 - x1, bh = y2 - y1;
  applyStroke(ctx, d.style);
  ctx.strokeRect(x1, y1, bw, bh);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
  const ratios = [0.25, 0.333, 0.5, 0.667, 0.75];
  ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.4;
  for (const r of ratios) {
    ctx.beginPath(); ctx.moveTo(x1, y1 + bh * r); ctx.lineTo(x2, y1 + bh * r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + bw * r, y1); ctx.lineTo(x1 + bw * r, y2); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.05;
    ctx.fillRect(x1, y1, bw, bh); ctx.globalAlpha = 1;
  }
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderGannSquare(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const side = Math.max(Math.abs(p.b.x - p.a.x), Math.abs(p.b.y - p.a.y));
  applyStroke(ctx, d.style);
  ctx.strokeRect(p.a.x, p.a.y, side, side);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.a.x + side, p.a.y + side); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.a.x + side, p.a.y); ctx.lineTo(p.a.x, p.a.y + side); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderGannFan(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const baseAngle = angle(p.a.x, p.a.y, p.b.x, p.b.y);
  const fanAngles = [-0.4, -0.25, -0.125, 0, 0.125, 0.25, 0.4];
  const colors = ['#EF535080', '#FF980080', '#FFC10780', '#2962FF', '#4CAF5080', '#00968880', '#00BCD480'];
  const len = Math.max(w, h) * 2;
  for (let i = 0; i < fanAngles.length; i++) {
    const a = baseAngle + fanAngles[i];
    ctx.strokeStyle = colors[i]; ctx.lineWidth = i === 3 ? 2 : 1;
    ctx.setLineDash(i === 3 ? [] : [4, 3]);
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.a.x + Math.cos(a) * len, p.a.y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// FIBONACCI TOOLS
// ────────────────────────────────────────────────────────────────────────

const FIB_LEVELS = [
  { r: 0,     label: '0',     color: '#787B86' },
  { r: 0.236, label: '0.236', color: '#787B86' },
  { r: 0.382, label: '0.382', color: '#787B86' },
  { r: 0.5,   label: '0.5',   color: '#787B86' },
  { r: 0.618, label: '0.618', color: '#4CAF50' },
  { r: 0.786, label: '0.786', color: '#787B86' },
  { r: 1,     label: '1',     color: '#787B86' },
];

const FIB_EXT_LEVELS = [
  ...FIB_LEVELS,
  { r: 1.272, label: '1.272', color: '#00BCD4' },
  { r: 1.618, label: '1.618', color: '#E91E63' },
  { r: 2.618, label: '2.618', color: '#673AB7' },
];

function renderFibonacci(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, priceToY: PriceToY, w: number) {
  const p = pts2(d, toXY); if (!p) return;
  const high = Math.max(d.points[0].price, d.points[1].price);
  const low  = Math.min(d.points[0].price, d.points[1].price);
  const range = high - low; if (range <= 0) return;
  const leftX = Math.min(p.a.x, p.b.x);
  const rightX = Math.max(p.a.x, p.b.x);

  // Determine which levels to render: custom config or hardcoded defaults
  const configLevels = d.config?.fibLevels;
  const activeLevels: { r: number; label: string; color: string }[] = configLevels
    ? configLevels.filter(l => l.enabled).map(l => ({ r: l.r, label: String(l.r), color: l.color }))
    : FIB_LEVELS;

  // Line style from config
  const lineWidth = d.config?.levelsLineWidth ?? 1;
  const lineStyle = d.config?.levelsLineStyle ?? 'solid';
  const extend = d.config?.extend ?? 'none';

  // Compute all Y positions first
  const levelYs: { lv: typeof activeLevels[number]; price: number; y: number }[] = [];
  for (const lv of activeLevels) {
    const price = high - range * lv.r;
    const y = priceToY(price);
    if (y !== null) levelYs.push({ lv, price, y });
  }
  if (levelYs.length < 2) return;

  // Draw overall background fill across entire fib range
  const topY = levelYs[0].y;
  const bottomY = levelYs[levelYs.length - 1].y;
  ctx.fillStyle = '#808080';
  ctx.globalAlpha = 0.15;
  ctx.fillRect(leftX, Math.min(topY, bottomY), rightX - leftX, Math.abs(bottomY - topY));
  ctx.globalAlpha = 1;

  // Draw individual band fills with alternating opacity
  for (let i = 0; i < levelYs.length - 1; i++) {
    const curY = levelYs[i].y;
    const nextY = levelYs[i + 1].y;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = i % 2 === 0 ? 0.04 : 0.08;
    ctx.fillRect(leftX, Math.min(curY, nextY), rightX - leftX, Math.abs(nextY - curY));
  }
  ctx.globalAlpha = 1;

  // Determine horizontal line extend boundaries
  const lineLeft  = (extend === 'left' || extend === 'both') ? 0 : leftX;
  const lineRight = (extend === 'right' || extend === 'both') ? w : rightX;

  // Draw horizontal lines and labels
  ctx.font = '11px "SF Mono",Monaco,Consolas,monospace';
  ctx.textBaseline = 'middle';

  // Apply dash style from config
  if (lineStyle === 'dashed') ctx.setLineDash([8, 4]);
  else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);

  for (const { lv, price, y } of levelYs) {
    ctx.strokeStyle = lv.color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(lineLeft, y);
    ctx.lineTo(lineRight, y);
    ctx.stroke();

    // Label: "0.236 (5,196.438)"
    ctx.fillStyle = lv.color;
    ctx.textAlign = 'left';
    ctx.fillText(`${lv.label} (${pfmt(price)})`, leftX + 6, y - 10);
  }
  ctx.setLineDash([]);

  // Draw diagonal trend line connecting the two anchor points
  const showTrendLine = d.config?.showTrendLine !== false; // default true
  if (showTrendLine) {
    const trendColor = d.config?.trendLineColor ?? 'rgba(255,255,255,0.3)';
    const trendStyle = d.config?.trendLineStyle ?? 'dashed';
    ctx.strokeStyle = trendColor;
    ctx.lineWidth = 1;
    if (trendStyle === 'dashed') ctx.setLineDash([4, 4]);
    else if (trendStyle === 'dotted') ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderFibExtension(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, priceToY: PriceToY, _w: number) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  const range = Math.abs(d.points[1].price - d.points[0].price); if (range <= 0) return;
  const basePrice = d.points[2].price;
  const direction = d.points[1].price > d.points[0].price ? 1 : -1;
  const leftX = Math.min(p.a.x, p.b.x, p.c.x);
  const rightX = Math.max(p.a.x, p.b.x, p.c.x);

  // Compute all level Y positions
  const levelYs: { lv: typeof FIB_EXT_LEVELS[number]; price: number; y: number }[] = [];
  for (const lv of FIB_EXT_LEVELS) {
    const price = basePrice + direction * range * lv.r;
    const y = priceToY(price);
    if (y !== null) levelYs.push({ lv, price, y });
  }
  if (levelYs.length < 2) return;

  // Background fill across entire extension range
  const ys = levelYs.map(l => l.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  ctx.fillStyle = '#808080';
  ctx.globalAlpha = 0.15;
  ctx.fillRect(leftX, minY, rightX - leftX, maxY - minY);
  ctx.globalAlpha = 1;

  // Draw lines and labels
  ctx.font = '11px "SF Mono",Monaco,Consolas,monospace';
  ctx.textBaseline = 'middle';
  for (const { lv, price, y } of levelYs) {
    ctx.strokeStyle = lv.color === '#4CAF50' ? '#4CAF50' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(leftX, y); ctx.lineTo(rightX, y); ctx.stroke();
    ctx.fillStyle = lv.color === '#4CAF50' ? '#4CAF50' : 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(`${lv.label} (${pfmt(price)})`, leftX + 6, y - 10);
  }

  // Connecting lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.stroke();
  ctx.setLineDash([]);

  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderFibChannel(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  const offsetY = p.c.y - p.a.y;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#787B86', '#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
  for (let i = 0; i < ratios.length; i++) {
    const offR = offsetY * ratios[i];
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y + offR); ctx.lineTo(p.b.x, p.b.y + offR); ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderFibTimezone(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const dx = p.b.x - p.a.x; if (Math.abs(dx) < 1) return;
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21];
  const colors = ['#78909C', '#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#00BCD4', '#E91E63'];
  ctx.font = '10px "SF Mono",Monaco,Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < fibs.length; i++) {
    const x = p.a.x + dx * fibs[i];
    ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = colors[i % colors.length];
    ctx.fillText(String(fibs[i]), x, 4);
  }
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderFibCircle(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const r0 = dist(p.a.x, p.a.y, p.b.x, p.b.y);
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
  for (let i = 0; i < ratios.length; i++) {
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(p.a.x, p.a.y, r0 * ratios[i], 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderFibSpeedFan(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
  for (let i = 0; i < ratios.length; i++) {
    const ty = p.a.y + dy * ratios[i];
    const [ex, ey] = extendRay(p.a.x, p.a.y, p.a.x + dx, ty, w, h);
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  applyStroke(ctx, d.style);
  const [rx, ry] = extendRay(p.a.x, p.a.y, p.b.x, p.b.y, w, h);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderFibWedge(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
  const colors = ['#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0'];
  applyStroke(ctx, d.style);
  const [r1x, r1y] = extendRay(p.a.x, p.a.y, p.b.x, p.b.y, w, h);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(r1x, r1y); ctx.stroke();
  const [r2x, r2y] = extendRay(p.a.x, p.a.y, p.c.x, p.c.y, w, h);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(r2x, r2y); ctx.stroke();
  for (let i = 0; i < ratios.length; i++) {
    const ix = lerp(p.b.x, p.c.x, ratios[i]);
    const iy = lerp(p.b.y, p.c.y, ratios[i]);
    const [ex, ey] = extendRay(p.a.x, p.a.y, ix, iy, w, h);
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// PATTERN TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderMultiPointPattern(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, defLabels: string[]) {
  const pts = d.points.map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  const labels = d.labels || defLabels;
  ctx.font = 'bold 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < pts.length; i++) {
    drawAnchor(ctx, pts[i].x, pts[i].y, d.style.color);
    if (labels[i]) {
      const above = i === 0 || (i > 0 && pts[i].y < pts[i - 1].y);
      ctx.fillStyle = d.style.color;
      ctx.textBaseline = above ? 'bottom' : 'top';
      ctx.fillText(labels[i], pts[i].x, pts[i].y + (above ? -10 : 10));
    }
  }
}

function renderHeadShoulders(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  renderMultiPointPattern(ctx, d, toXY, ['LS', 'N', 'H', 'N', 'RS', 'N', 'B']);
  const pts = d.points.map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (pts.length >= 6) {
    ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.6;
    applyStroke(ctx, d.style);
    ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[3].x, pts[3].y);
    if (pts[5]) ctx.lineTo(pts[5].x, pts[5].y);
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
}

// ────────────────────────────────────────────────────────────────────────
// POSITION / PREDICTION TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderPosition(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, priceToY: PriceToY, w: number, side: 'long' | 'short') {
  if (d.points.length < 3) return;
  const entryPrice = d.points[0].price, tpPrice = d.points[1].price, slPrice = d.points[2].price;
  const p0 = toXY(d.points[0].time, entryPrice); if (!p0) return;
  const p1 = d.points[1].time ? toXY(d.points[1].time, tpPrice) : null;
  const entryY = priceToY(entryPrice), tpY = priceToY(tpPrice), slY = priceToY(slPrice);
  if (entryY === null || tpY === null || slY === null) return;

  // Box width: use second point's X if available, else fallback to fixed width
  const leftX = p0.x;
  const rightX = p1 ? Math.max(p1.x, leftX + 60) : Math.min(leftX + 280, w);
  const boxW = rightX - leftX;
  if (boxW < 20) return;

  const dec = entryPrice > 10 ? 2 : 3;
  const profitColor = '#26A69A'; // green/teal
  const lossColor   = '#EF5350'; // red

  // Determine which zone is profit and which is loss
  const tpIsProfit = side === 'long' ? tpPrice > entryPrice : tpPrice < entryPrice;
  const tpZoneColor = tpIsProfit ? profitColor : lossColor;
  const slZoneColor = tpIsProfit ? lossColor : profitColor;

  // ── TP zone fill ──
  ctx.fillStyle = tpZoneColor;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(leftX, Math.min(entryY, tpY), boxW, Math.abs(tpY - entryY));
  ctx.globalAlpha = 1;

  // TP zone border
  ctx.strokeStyle = tpZoneColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(leftX, Math.min(entryY, tpY), boxW, Math.abs(tpY - entryY));

  // ── SL zone fill ──
  ctx.fillStyle = slZoneColor;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(leftX, Math.min(entryY, slY), boxW, Math.abs(slY - entryY));
  ctx.globalAlpha = 1;

  // SL zone border
  ctx.strokeStyle = slZoneColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, Math.min(entryY, slY), boxW, Math.abs(slY - entryY));

  // ── Entry line (dashed) ──
  ctx.strokeStyle = '#D1D4DC';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);
  ctx.beginPath(); ctx.moveTo(leftX, entryY); ctx.lineTo(rightX, entryY); ctx.stroke();
  ctx.setLineDash([]);

  // Only show calculations, labels, and drag handles when selected
  if (!d.selected) return;

  // ── Calculations for labels ──
  const tpDist = Math.abs(tpPrice - entryPrice);
  const slDist = Math.abs(slPrice - entryPrice);
  const tpPct = entryPrice !== 0 ? ((tpDist / entryPrice) * 100).toFixed(3) : '0.000';
  const slPct = entryPrice !== 0 ? ((slDist / entryPrice) * 100).toFixed(3) : '0.000';
  const rr = slDist > 0 ? (tpDist / slDist).toFixed(0) : '∞';
  const tpAmount = tpDist.toFixed(dec);
  const slAmount = slDist.toFixed(dec);

  // ── Target pill label ──
  const targetLabel = `Target: ${tpDist.toFixed(dec)} (${tpPct}%) ${pfmt(tpPrice)}, Amount: ${tpAmount}`;
  const tpLabelY = tpY < entryY ? tpY - 2 : tpY + 2;
  drawPositionPill(ctx, targetLabel, leftX + boxW / 2, tpLabelY, tpZoneColor, tpY < entryY ? 'above' : 'below');

  // ── Stop pill label ──
  const stopLabel = `Stop: ${slDist.toFixed(dec)} (${slPct}%) ${pfmt(slPrice)}, Amount: ${slAmount}`;
  const slLabelY = slY > entryY ? slY + 2 : slY - 2;
  drawPositionPill(ctx, stopLabel, leftX + boxW / 2, slLabelY, slZoneColor, slY > entryY ? 'below' : 'above');

  // ── P&L / Risk:Reward center label ──
  const pnl = side === 'long' ? (tpPrice - entryPrice) : (entryPrice - tpPrice);
  const pnlLabel = `Open P&L: ${pnl.toFixed(dec)}, Qty: 0`;
  const rrLabel = `Risk/reward ratio: ${rr}`;
  const centerY = entryY;
  const centerX = leftX + boxW / 2;
  drawPositionPill(ctx, pnlLabel, centerX, centerY - 8, '#26A69A', 'center');
  drawPositionPill(ctx, rrLabel, centerX, centerY + 10, '#26A69A', 'center');

  // ── Drag handles (small squares at corners and edges) ──
  const handleSize = 5;
  const handleColor = '#42a5f5';
  const handles = [
    // Top-left, top-right
    { x: leftX, y: Math.min(tpY, entryY) },
    { x: rightX, y: Math.min(tpY, entryY) },
    // Entry line left, entry line right
    { x: leftX, y: entryY },
    { x: rightX, y: entryY },
    // Bottom-left, bottom-right
    { x: leftX, y: Math.max(slY, entryY) },
    { x: rightX, y: Math.max(slY, entryY) },
  ];
  for (const h of handles) {
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#1e222d';
    ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
    ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
  }
}

/** Draws a rounded pill label for position tools */
function drawPositionPill(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  bg: string, position: 'above' | 'below' | 'center',
) {
  ctx.font = '11px "SF Mono",Monaco,Consolas,monospace';
  const tw = ctx.measureText(text).width;
  const pad = 8;
  const pillW = tw + pad * 2;
  const pillH = 22;
  const lx = x - pillW / 2;
  let ly: number;
  if (position === 'above') ly = y - pillH - 2;
  else if (position === 'below') ly = y + 4;
  else ly = y - pillH / 2;

  ctx.beginPath();
  roundRect(ctx, lx, ly, pillW, pillH, 4);
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, ly + pillH / 2);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderProjection(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.stroke();
  const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(p.c.x, p.c.y); ctx.lineTo(p.c.x + dx, p.c.y + dy); ctx.stroke();
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
  drawAnchor(ctx, p.c.x + dx, p.c.y + dy, '#4CAF50');
}

function renderPriceRange(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const x = Math.min(p.a.x, p.b.x), y = Math.min(p.a.y, p.b.y);
  const rw = Math.abs(p.b.x - p.a.x), rh = Math.abs(p.b.y - p.a.y);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.08;
    ctx.fillRect(x, y, rw, rh); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.strokeRect(x, y, rw, rh);
  const diff = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? ((diff / d.points[0].price) * 100).toFixed(2) : '0.00';
  const color = diff >= 0 ? '#26A69A' : '#EF5350';
  pill(ctx, `${diff >= 0 ? '+' : ''}${pfmt(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`, (p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2, color);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderDateRange(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const x1 = Math.min(p.a.x, p.b.x), x2 = Math.max(p.a.x, p.b.x);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.08;
    ctx.fillRect(x1, 0, x2 - x1, h); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h); ctx.stroke();
  const bars = Math.abs(d.points[1].time - d.points[0].time);
  pill(ctx, `${Math.round(bars / 60)}min`, (x1 + x2) / 2, h - 20, d.style.color);
}

function renderDatePriceRange(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const x = Math.min(p.a.x, p.b.x), y = Math.min(p.a.y, p.b.y);
  const rw = Math.abs(p.b.x - p.a.x), rh = Math.abs(p.b.y - p.a.y);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.08;
    ctx.fillRect(x, y, rw, rh); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.strokeRect(x, y, rw, rh);
  const diff = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? ((diff / d.points[0].price) * 100).toFixed(2) : '0.00';
  const color = diff >= 0 ? '#26A69A' : '#EF5350';
  pill(ctx, `${diff >= 0 ? '+' : ''}${pfmt(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`, (p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2, color);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderBarsPattern(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  ctx.setLineDash([6, 4]); applyStroke(ctx, d.style);
  const x = Math.min(p.a.x, p.b.x), y = Math.min(p.a.y, p.b.y);
  ctx.strokeRect(x, y, Math.abs(p.b.x - p.a.x), Math.abs(p.b.y - p.a.y));
  ctx.setLineDash([]);
  ctx.font = '11px sans-serif'; ctx.fillStyle = d.style.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Bars Pattern', (p.a.x + p.b.x) / 2, Math.min(p.a.y, p.b.y) - 4);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// NEW FIBONACCI TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderTrendFibTime(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, h: number) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  // Draw the trend line
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.stroke();
  // Fib time zones based on the horizontal span of the first two points
  const dx = p.b.x - p.a.x; if (Math.abs(dx) < 1) return;
  const fibs = [1, 1, 2, 3, 5, 8, 13];
  const colors = ['#78909C', '#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#00BCD4'];
  ctx.font = '10px "SF Mono",Monaco,Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < fibs.length; i++) {
    const x = p.c.x + dx * fibs[i];
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = colors[i];
    ctx.fillText(String(fibs[i]), x, 4);
  }
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderFibSpiral(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const r0 = dist(p.a.x, p.a.y, p.b.x, p.b.y);
  if (r0 < 2) return;
  const baseAngle = angle(p.a.x, p.a.y, p.b.x, p.b.y);
  const phi = 1.618033988749895; // golden ratio
  applyStroke(ctx, d.style);
  ctx.beginPath();
  const steps = 300;
  const maxTurns = 4;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * maxTurns * Math.PI * 2;
    const r = r0 * Math.pow(phi, t / (Math.PI * 2));
    const x = p.a.x + Math.cos(baseAngle + t) * r;
    const y = p.a.y + Math.sin(baseAngle + t) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderFibSpeedArcs(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const r0 = dist(p.a.x, p.a.y, p.b.x, p.b.y);
  if (r0 < 2) return;
  const startAngle = angle(p.a.x, p.a.y, p.b.x, p.b.y);
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
  // Draw the base line
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  // Draw arcs
  for (let i = 0; i < ratios.length; i++) {
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(p.a.x, p.a.y, r0 * ratios[i], startAngle - Math.PI / 2, startAngle + Math.PI / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderPitchfan(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  // Fan rays from point A through fibonacci ratios on the B→C segment
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#787B86', '#F44336', '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#787B86'];
  for (let i = 0; i < ratios.length; i++) {
    const tx = lerp(p.b.x, p.c.x, ratios[i]);
    const ty = lerp(p.b.y, p.c.y, ratios[i]);
    const [ex, ey] = extendRay(p.a.x, p.a.y, tx, ty, w, h);
    ctx.strokeStyle = colors[i]; ctx.lineWidth = i === 0 || i === 6 ? 1.5 : 1;
    ctx.setLineDash(i === 0 || i === 6 ? [] : [4, 3]);
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.setLineDash([]);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderGannSquareFixed(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const side = Math.max(Math.abs(p.b.x - p.a.x), Math.abs(p.b.y - p.a.y));
  const x1 = p.a.x, y1 = p.a.y;
  applyStroke(ctx, d.style);
  ctx.strokeRect(x1, y1, side, side);
  // Diagonals
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + side, y1 + side); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 + side, y1); ctx.lineTo(x1, y1 + side); ctx.stroke();
  // Mid lines
  ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(x1 + side / 2, y1); ctx.lineTo(x1 + side / 2, y1 + side); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1 + side / 2); ctx.lineTo(x1 + side, y1 + side / 2); ctx.stroke();
  // Quarter lines
  ctx.globalAlpha = 0.3;
  for (const r of [0.25, 0.75]) {
    ctx.beginPath(); ctx.moveTo(x1 + side * r, y1); ctx.lineTo(x1 + side * r, y1 + side); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1 + side * r); ctx.lineTo(x1 + side, y1 + side * r); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.05;
    ctx.fillRect(x1, y1, side, side); ctx.globalAlpha = 1;
  }
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// CYCLES TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderCyclicLines(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const dx = Math.abs(p.b.x - p.a.x); if (dx < 2) return;
  applyStroke(ctx, d.style);
  const startX = Math.min(p.a.x, p.b.x);
  const count = Math.ceil((w - startX) / dx) + 1;
  for (let i = 0; i < count; i++) {
    const x = startX + dx * i;
    if (x > w) break;
    ctx.globalAlpha = i === 0 ? 1 : 0.6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderTimeCycles(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number, _h: number) {
  const p = pts2(d, toXY); if (!p) return;
  const r = Math.abs(p.b.x - p.a.x); if (r < 2) return;
  applyStroke(ctx, d.style);
  const startX = Math.min(p.a.x, p.b.x);
  const baseY = Math.max(p.a.y, p.b.y);
  const count = Math.ceil((w - startX) / (2 * r)) + 1;
  for (let i = 0; i < count; i++) {
    const cx = startX + r + i * 2 * r;
    ctx.globalAlpha = i === 0 ? 1 : 0.5;
    ctx.beginPath(); ctx.arc(cx, baseY, r, Math.PI, 0); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderSineLine(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number) {
  const p = pts2(d, toXY); if (!p) return;
  const wavelength = Math.abs(p.b.x - p.a.x) * 2; if (wavelength < 4) return;
  const amplitude = Math.abs(p.b.y - p.a.y);
  const midY = (p.a.y + p.b.y) / 2;
  applyStroke(ctx, d.style);
  ctx.beginPath();
  const startX = Math.min(p.a.x, p.b.x);
  for (let x = startX; x <= w; x += 2) {
    const phase = ((x - startX) / wavelength) * Math.PI * 2;
    const y = midY + Math.sin(phase) * amplitude;
    if (x === startX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// FORECASTING / VOLUME TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderPositionForecast(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.stroke();
  const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
  // Projected continuation
  ctx.setLineDash([6, 4]); ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.c.x, p.c.y); ctx.lineTo(p.c.x + dx, p.c.y + dy); ctx.stroke();
  ctx.setLineDash([]);
  // Fill the projected area
  ctx.fillStyle = '#4CAF50'; ctx.globalAlpha = 0.06;
  ctx.beginPath(); ctx.moveTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y);
  ctx.lineTo(p.c.x + dx, p.c.y + dy); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Label
  ctx.font = '10px "SF Mono",Monaco,Consolas,monospace'; ctx.fillStyle = '#4CAF50';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Forecast', p.c.x + dx / 2, p.c.y + dy / 2 - 6);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
  drawAnchor(ctx, p.c.x + dx, p.c.y + dy, '#4CAF50');
}

function renderGhostFeed(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  // Dashed rectangle showing ghost pattern area
  ctx.setLineDash([6, 4]); applyStroke(ctx, d.style);
  ctx.globalAlpha = 0.4;
  const x = Math.min(p.a.x, p.b.x), y = Math.min(p.a.y, p.b.y);
  const rw = Math.abs(p.b.x - p.a.x), rh = Math.abs(p.b.y - p.a.y);
  ctx.strokeRect(x, y, rw, rh);
  // Ghost duplicate offset to the right
  const offsetX = rw;
  ctx.globalAlpha = 0.2;
  ctx.strokeRect(x + offsetX, y, rw, rh);
  // Simulated ghost pattern lines inside the duplicate
  ctx.beginPath();
  ctx.moveTo(x + offsetX, y + rh * 0.7);
  ctx.lineTo(x + offsetX + rw * 0.3, y + rh * 0.3);
  ctx.lineTo(x + offsetX + rw * 0.6, y + rh * 0.5);
  ctx.lineTo(x + offsetX + rw, y + rh * 0.2);
  ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.font = '10px sans-serif'; ctx.fillStyle = d.style.color; ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom'; ctx.globalAlpha = 0.5;
  ctx.fillText('Ghost Feed', (p.a.x + p.b.x) / 2 + offsetX / 2, y - 4);
  ctx.globalAlpha = 1;
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderSector(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  ctx.beginPath();
  ctx.moveTo(p.a.x, p.a.y);
  ctx.lineTo(p.b.x, p.a.y);
  ctx.lineTo(p.b.x, p.b.y);
  ctx.closePath();
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderAnchoredVWAP(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY, w: number) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  // Horizontal VWAP line from anchor to right edge
  ctx.strokeStyle = d.style.color; ctx.lineWidth = d.style.lineWidth; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(w, p.y); ctx.stroke();
  // Upper and lower standard deviation bands
  const bandOffset = 25;
  ctx.globalAlpha = 0.4; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p.x, p.y - bandOffset); ctx.lineTo(w, p.y - bandOffset); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x, p.y + bandOffset); ctx.lineTo(w, p.y + bandOffset); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // Fill between bands
  ctx.fillStyle = d.style.color; ctx.globalAlpha = 0.04;
  ctx.fillRect(p.x, p.y - bandOffset, w - p.x, bandOffset * 2);
  ctx.globalAlpha = 1;
  // Label
  pill(ctx, 'VWAP', p.x + 30, p.y, d.style.color);
  drawAnchor(ctx, p.x, p.y, d.style.color);
}

function renderFixedRangeVolProfile(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const x1 = Math.min(p.a.x, p.b.x), x2 = Math.max(p.a.x, p.b.x);
  const y1 = Math.min(p.a.y, p.b.y), y2 = Math.max(p.a.y, p.b.y);
  const totalH = y2 - y1; if (totalH < 10) return;
  // Draw range boundary lines
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); ctx.stroke();
  // Simulated volume profile bars
  const rows = 20;
  const rowH = totalH / rows;
  const maxBarW = (x2 - x1) * 0.6;
  ctx.fillStyle = d.style.fillColor || d.style.color;
  for (let i = 0; i < rows; i++) {
    // Bell-curve-like distribution
    const t = (i - rows / 2) / (rows / 2);
    const barW = maxBarW * Math.exp(-t * t * 2) * (0.5 + Math.random() * 0.5);
    const ry = y1 + i * rowH;
    const isVP = Math.abs(t) < 0.2; // value area
    ctx.globalAlpha = isVP ? 0.3 : 0.12;
    ctx.fillRect(x1, ry, barW, rowH - 1);
  }
  ctx.globalAlpha = 1;
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderAnchoredVolProfile(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  // Volume profile bars extending to the right from anchor
  const rows = 15;
  const rowH = 8;
  const maxBarW = 80;
  ctx.fillStyle = d.style.fillColor || d.style.color;
  const startY = p.y - (rows * rowH) / 2;
  for (let i = 0; i < rows; i++) {
    const t = (i - rows / 2) / (rows / 2);
    const barW = maxBarW * Math.exp(-t * t * 2);
    const ry = startY + i * rowH;
    const isVP = Math.abs(t) < 0.25;
    ctx.globalAlpha = isVP ? 0.3 : 0.12;
    ctx.fillRect(p.x, ry, barW, rowH - 1);
  }
  ctx.globalAlpha = 1;
  // Anchor line
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(p.x, startY); ctx.lineTo(p.x, startY + rows * rowH); ctx.stroke();
  drawAnchor(ctx, p.x, p.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// ANNOTATION TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderText(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0] || !d.text) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const sz = d.style.fontSize || 14;
  ctx.font = `${sz}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  ctx.fillStyle = d.style.color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(d.text, p.x, p.y);
}

function renderAnchoredText(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0] || !d.text) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const sz = d.style.fontSize || 14;
  ctx.font = `${sz}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  const tw = ctx.measureText(d.text).width;
  ctx.beginPath(); roundRect(ctx, p.x - 4, p.y - 2, tw + 12, sz + 8, 4);
  ctx.fillStyle = '#1E222D'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
  ctx.fillStyle = d.style.color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(d.text, p.x + 2, p.y + 2);
  ctx.beginPath(); ctx.moveTo(p.x + tw / 2, p.y + sz + 6); ctx.lineTo(p.x + tw / 2, p.y + sz + 20); ctx.stroke();
}

function renderCallout(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 2) return;
  const p = pts2(d, toXY); if (!p) return;
  const text = d.text || 'Callout';
  const sz = d.style.fontSize || 13;
  ctx.font = `${sz}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  const tw = ctx.measureText(text).width;
  const bw = tw + 20, bh = sz + 16;
  ctx.beginPath(); roundRect(ctx, p.b.x - bw / 2, p.b.y - bh / 2, bw, bh, 5);
  ctx.fillStyle = d.style.fillColor || '#2962FF'; ctx.globalAlpha = d.style.fillOpacity ?? 0.15;
  ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.fillStyle = d.style.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, p.b.x, p.b.y);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
}

function renderPriceLabel(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  pill(ctx, d.text || pfmt(d.points[0].price), p.x, p.y, d.style.color);
}

function renderArrowMarker(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const sz = 20;
  ctx.fillStyle = d.style.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - sz); ctx.lineTo(p.x - sz / 2, p.y); ctx.lineTo(p.x - sz / 4, p.y);
  ctx.lineTo(p.x - sz / 4, p.y + sz / 2); ctx.lineTo(p.x + sz / 4, p.y + sz / 2);
  ctx.lineTo(p.x + sz / 4, p.y); ctx.lineTo(p.x + sz / 2, p.y);
  ctx.closePath(); ctx.fill();
}

function renderFlagMark(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 40); ctx.stroke();
  ctx.fillStyle = d.style.color; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(p.x, p.y - 40); ctx.lineTo(p.x + 20, p.y - 33); ctx.lineTo(p.x, p.y - 26);
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}

function renderNote(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const text = d.text || 'Note';
  const sz = d.style.fontSize || 12;
  ctx.font = `${sz}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  const lines = text.split('\n');
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const bw = maxW + 16, bh = lines.length * (sz + 4) + 12;
  ctx.beginPath(); roundRect(ctx, p.x, p.y, bw, bh, 4);
  ctx.fillStyle = '#1E222D'; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
  ctx.fillStyle = d.style.color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], p.x + 8, p.y + 6 + i * (sz + 4));
}

function renderSignpost(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = 2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 50); ctx.stroke();
  const text = d.text || '▶';
  ctx.font = '11px sans-serif'; const tw = ctx.measureText(text).width;
  ctx.fillStyle = d.style.color;
  ctx.beginPath(); roundRect(ctx, p.x - 2, p.y - 54, tw + 12, 18, 3); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x + 4, p.y - 45);
}

// ────────────────────────────────────────────────────────────────────────
// SHAPE TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderRectangle(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const x = Math.min(p.a.x, p.b.x), y = Math.min(p.a.y, p.b.y);
  const rw = Math.abs(p.b.x - p.a.x), rh = Math.abs(p.b.y - p.a.y);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fillRect(x, y, rw, rh); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.strokeRect(x, y, rw, rh);
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderRotatedRectangle(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
  const len = Math.sqrt(dx * dx + dy * dy); if (len === 0) return;
  const nx = -dy / len, ny = dx / len;
  const projDist = (p.c.x - p.a.x) * nx + (p.c.y - p.a.y) * ny;
  ctx.beginPath();
  ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y);
  ctx.lineTo(p.b.x + nx * projDist, p.b.y + ny * projDist);
  ctx.lineTo(p.a.x + nx * projDist, p.a.y + ny * projDist);
  ctx.closePath();
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderCircle(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const r = dist(p.a.x, p.a.y, p.b.x, p.b.y);
  ctx.beginPath(); ctx.arc(p.a.x, p.a.y, r, 0, Math.PI * 2);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderEllipse(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const cx = (p.a.x + p.b.x) / 2, cy = (p.a.y + p.b.y) / 2;
  const rx = Math.abs(p.b.x - p.a.x) / 2, ry = Math.abs(p.b.y - p.a.y) / 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
}

function renderTriangleShape(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.lineTo(p.c.x, p.c.y); ctx.closePath();
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.1;
    ctx.fill(); ctx.globalAlpha = 1;
  }
  applyStroke(ctx, d.style); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderPolyline(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const pts = d.points.map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  for (const p of pts) drawAnchor(ctx, p.x, p.y, d.style.color);
}

function renderCurve(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.quadraticCurveTo(p.b.x, p.b.y, p.c.x, p.c.y); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.b.x, p.b.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

function renderArc(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 3) return;
  const p = pts3(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.quadraticCurveTo(p.b.x, p.b.y, p.c.x, p.c.y); ctx.stroke();
  drawAnchor(ctx, p.a.x, p.a.y, d.style.color);
  drawAnchor(ctx, p.c.x, p.c.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// ARROW TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderArrow(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  // arrowhead
  const angle = Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x);
  const hl = 12;
  ctx.fillStyle = d.style.color;
  ctx.beginPath();
  ctx.moveTo(p.b.x, p.b.y);
  ctx.lineTo(p.b.x - hl * Math.cos(angle - 0.4), p.b.y - hl * Math.sin(angle - 0.4));
  ctx.lineTo(p.b.x - hl * Math.cos(angle + 0.4), p.b.y - hl * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}

function renderArrowUp(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const sz = 16;
  ctx.fillStyle = d.style.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - sz);
  ctx.lineTo(p.x - sz * 0.6, p.y + sz * 0.3);
  ctx.lineTo(p.x + sz * 0.6, p.y + sz * 0.3);
  ctx.closePath(); ctx.fill();
}

function renderArrowDown(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (!d.points[0]) return;
  const p = toXY(d.points[0].time, d.points[0].price); if (!p) return;
  const sz = 16;
  ctx.fillStyle = d.style.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + sz);
  ctx.lineTo(p.x - sz * 0.6, p.y - sz * 0.3);
  ctx.lineTo(p.x + sz * 0.6, p.y - sz * 0.3);
  ctx.closePath(); ctx.fill();
}

// ────────────────────────────────────────────────────────────────────────
// PATH & DOUBLE-CURVE TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderPath(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const pts = d.points.map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return;
  applyStroke(ctx, d.style);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.stroke();
  if (d.style.fillColor) {
    ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.05; ctx.fill(); ctx.globalAlpha = 1;
  }
  for (const p of pts) drawAnchor(ctx, p.x, p.y, d.style.color);
}

function renderDoubleCurve(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  if (d.points.length < 4) return;
  const mapped = d.points.map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (mapped.length < 4) return;
  applyStroke(ctx, d.style);
  // First curve: points 0-1-2
  ctx.beginPath(); ctx.moveTo(mapped[0].x, mapped[0].y);
  ctx.quadraticCurveTo(mapped[1].x, mapped[1].y, mapped[2].x, mapped[2].y); ctx.stroke();
  // Second curve: points 2-3-(implicit endpoint or back to 0)
  ctx.beginPath(); ctx.moveTo(mapped[2].x, mapped[2].y);
  ctx.quadraticCurveTo(mapped[3].x, mapped[3].y, mapped.length > 4 ? mapped[4].x : mapped[0].x, mapped.length > 4 ? mapped[4].y : mapped[0].y);
  ctx.stroke();
  for (const p of mapped) drawAnchor(ctx, p.x, p.y, d.style.color);
}

// ────────────────────────────────────────────────────────────────────────
// BRUSH TOOLS
// ────────────────────────────────────────────────────────────────────────

function renderBrush(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const pts = (d.freehandPoints || d.points).map(p => toXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return;
  ctx.strokeStyle = d.style.color; ctx.lineWidth = d.style.lineWidth;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  if (d.type === 'highlighter') ctx.globalAlpha = d.style.fillOpacity ?? 0.3;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke(); ctx.globalAlpha = 1;
}

// ────────────────────────────────────────────────────────────────────────
// MEASURE TOOL
// ────────────────────────────────────────────────────────────────────────

function renderMeasure(ctx: CanvasRenderingContext2D, d: DrawingObject, toXY: PointToXY) {
  const p = pts2(d, toXY); if (!p) return;
  const diff = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? (diff / d.points[0].price) * 100 : 0;
  const positive = diff >= 0;
  const color = positive ? '#26A69A' : '#EF5350';
  const sign = positive ? '+' : '';
  const dec = d.points[0].price > 10 ? 2 : 5;
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(p.b.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.a.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.a.x, p.b.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  ctx.setLineDash([]);
  const label = `${sign}${diff.toFixed(dec)} (${sign}${pct.toFixed(2)}%)`;
  pill(ctx, label, p.b.x + 15, (p.a.y + p.b.y) / 2, color);
  drawAnchor(ctx, p.a.x, p.a.y, color);
  drawAnchor(ctx, p.b.x, p.b.y, color);
}

// ────────────────────────────────────────────────────────────────────────
// MAIN DISPATCH
// ────────────────────────────────────────────────────────────────────────

export function renderAllDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: DrawingObject[],
  toXY: PointToXY,
  priceToY: PriceToY,
  w: number,
  h: number,
) {
  for (const d of drawings) {
    if (!d.visible) continue;
    ctx.save();
    switch (d.type) {
      case 'hline':              renderHLine(ctx, d, priceToY, w); break;
      case 'vline':              renderVLine(ctx, d, toXY, h); break;
      case 'cross-line':         renderCrossLine(ctx, d, toXY, priceToY, w, h); break;
      case 'trendline':          renderTrendLine(ctx, d, toXY); break;
      case 'ray':                renderRay(ctx, d, toXY, w, h); break;
      case 'hray':               renderHRay(ctx, d, toXY, priceToY, w); break;
      case 'extended-line':      renderExtendedLine(ctx, d, toXY, w, h); break;
      case 'trend-angle':        renderTrendAngle(ctx, d, toXY); break;
      case 'info-line':          renderInfoLine(ctx, d, toXY); break;
      case 'parallel-channel':   renderParallelChannel(ctx, d, toXY); break;
      case 'pitchfork':          renderPitchfork(ctx, d, toXY, w, h, 'normal'); break;
      case 'schiff-pitchfork':   renderPitchfork(ctx, d, toXY, w, h, 'schiff'); break;
      case 'mod-schiff-pitchfork': renderPitchfork(ctx, d, toXY, w, h, 'mod-schiff'); break;
      case 'inside-pitchfork':   renderPitchfork(ctx, d, toXY, w, h, 'inside'); break;
      case 'gann-box':           renderGannBox(ctx, d, toXY); break;
      case 'gann-square':        renderGannSquare(ctx, d, toXY); break;
      case 'gann-square-fixed':  renderGannSquareFixed(ctx, d, toXY); break;
      case 'gann-fan':           renderGannFan(ctx, d, toXY, w, h); break;
      case 'fibonacci':          renderFibonacci(ctx, d, toXY, priceToY, w); break;
      case 'fib-trend-ext':      renderFibExtension(ctx, d, toXY, priceToY, w); break;
      case 'fib-channel':        renderFibChannel(ctx, d, toXY); break;
      case 'fib-timezone':       renderFibTimezone(ctx, d, toXY, h); break;
      case 'fib-speed-resistance-fan': renderFibSpeedFan(ctx, d, toXY, w, h); break;
      case 'trend-fib-time':     renderTrendFibTime(ctx, d, toXY, h); break;
      case 'fib-circle':         renderFibCircle(ctx, d, toXY); break;
      case 'fib-spiral':         renderFibSpiral(ctx, d, toXY); break;
      case 'fib-speed-arcs':     renderFibSpeedArcs(ctx, d, toXY); break;
      case 'fib-wedge':          renderFibWedge(ctx, d, toXY, w, h); break;
      case 'pitchfan':           renderPitchfan(ctx, d, toXY, w, h); break;
      case 'xabcd':              renderMultiPointPattern(ctx, d, toXY, ['X','A','B','C','D']); break;
      case 'cypher':             renderMultiPointPattern(ctx, d, toXY, ['X','A','B','C','D']); break;
      case 'abcd':               renderMultiPointPattern(ctx, d, toXY, ['A','B','C','D']); break;
      case 'triangle-pattern':   { const pts = d.points.map(pp => toXY(pp.time, pp.price)).filter(Boolean) as {x:number;y:number}[];
        if (pts.length >= 3) { applyStroke(ctx, d.style); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.closePath(); ctx.stroke(); if (d.style.fillColor) { ctx.fillStyle = d.style.fillColor; ctx.globalAlpha = d.style.fillOpacity ?? 0.05; ctx.fill(); ctx.globalAlpha = 1; } for (const pp of pts) drawAnchor(ctx, pp.x, pp.y, d.style.color); } break; }
      case 'three-drives':       renderMultiPointPattern(ctx, d, toXY, ['0','1','2','3','4','5','6']); break;
      case 'head-shoulders':     renderHeadShoulders(ctx, d, toXY); break;
      case 'elliott-impulse':    renderMultiPointPattern(ctx, d, toXY, ['0','1','2','3','4','5']); break;
      case 'elliott-correction': renderMultiPointPattern(ctx, d, toXY, ['A','B','C','D']); break;
      case 'elliott-triangle':   renderMultiPointPattern(ctx, d, toXY, ['A','B','C','D','E','F']); break;
      case 'elliott-double-combo': renderMultiPointPattern(ctx, d, toXY, ['W','X','Y','D']); break;
      case 'elliott-triple-combo': renderMultiPointPattern(ctx, d, toXY, ['W','X','Y','X2','Z','F']); break;
      case 'cyclic-lines':       renderCyclicLines(ctx, d, toXY, w, h); break;
      case 'time-cycles':        renderTimeCycles(ctx, d, toXY, w, h); break;
      case 'sine-line':          renderSineLine(ctx, d, toXY, w); break;
      case 'long-position':      renderPosition(ctx, d, toXY, priceToY, w, 'long'); break;
      case 'short-position':     renderPosition(ctx, d, toXY, priceToY, w, 'short'); break;
      case 'position-forecast':  renderPositionForecast(ctx, d, toXY); break;
      case 'ghost-feed':         renderGhostFeed(ctx, d, toXY); break;
      case 'sector':             renderSector(ctx, d, toXY); break;
      case 'anchored-vwap':      renderAnchoredVWAP(ctx, d, toXY, w); break;
      case 'fixed-range-vol-profile': renderFixedRangeVolProfile(ctx, d, toXY); break;
      case 'anchored-vol-profile': renderAnchoredVolProfile(ctx, d, toXY); break;
      case 'price-range':        renderPriceRange(ctx, d, toXY); break;
      case 'date-range':         renderDateRange(ctx, d, toXY, h); break;
      case 'date-price-range':   renderDatePriceRange(ctx, d, toXY); break;
      case 'bars-pattern':       renderBarsPattern(ctx, d, toXY); break;
      case 'text':               renderText(ctx, d, toXY); break;
      case 'anchored-text':      renderAnchoredText(ctx, d, toXY); break;
      case 'callout':            renderCallout(ctx, d, toXY); break;
      case 'price-label':        renderPriceLabel(ctx, d, toXY); break;
      case 'arrow-marker':       renderArrowMarker(ctx, d, toXY); break;
      case 'arrow':              renderArrow(ctx, d, toXY); break;
      case 'arrow-up':           renderArrowUp(ctx, d, toXY); break;
      case 'arrow-down':         renderArrowDown(ctx, d, toXY); break;
      case 'flag-mark':          renderFlagMark(ctx, d, toXY); break;
      case 'note':               renderNote(ctx, d, toXY); break;
      case 'signpost':           renderSignpost(ctx, d, toXY); break;
      case 'rectangle':          renderRectangle(ctx, d, toXY); break;
      case 'rotated-rectangle':  renderRotatedRectangle(ctx, d, toXY); break;
      case 'path':               renderPath(ctx, d, toXY); break;
      case 'circle':             renderCircle(ctx, d, toXY); break;
      case 'ellipse':            renderEllipse(ctx, d, toXY); break;
      case 'triangle-shape':     renderTriangleShape(ctx, d, toXY); break;
      case 'polyline':           renderPolyline(ctx, d, toXY); break;
      case 'curve':              renderCurve(ctx, d, toXY); break;
      case 'arc':                renderArc(ctx, d, toXY); break;
      case 'double-curve':       renderDoubleCurve(ctx, d, toXY); break;
      case 'brush':              renderBrush(ctx, d, toXY); break;
      case 'highlighter':        renderBrush(ctx, d, toXY); break;
      case 'measure':            renderMeasure(ctx, d, toXY); break;
    }

    // Draw selection handles for any selected drawing (except freehand)
    if (d.selected && d.type !== 'brush' && d.type !== 'highlighter') {
      for (const pt of d.points) {
        const xy = toXY(pt.time, pt.price);
        if (!xy) continue;
        ctx.beginPath();
        ctx.arc(xy.x, xy.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(xy.x, xy.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = d.style.color;
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
