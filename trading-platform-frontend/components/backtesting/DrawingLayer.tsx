'use client';

import { useRef, useEffect, useCallback, type RefObject } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '@/lib/drawing/types';
import { renderAllDrawings } from '@/lib/drawing/renderers';

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2) */
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/** Types that shouldn't be selected/dragged (freehand strokes) */
const FREEHAND_TYPES = new Set(['brush', 'highlighter']);

interface DrawingLayerProps {
    chartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    drawings: DrawingObject[];
    activePreview: { type: string; points: DrawingPoint[]; style: DrawingStyle } | null;
    /** Whether the user is in a freehand tool (brush / highlighter) */
    isFreehand?: boolean;
    onFreehandStart?: (point: DrawingPoint) => void;
    onFreehandMove?: (point: DrawingPoint) => void;
    onFreehandEnd?: () => void;
    onDoubleClick?: () => void;
    /** Drag callbacks for adjusting drawing anchor points */
    onDrawingPointDrag?: (drawingId: string, pointIndex: number, newPrice: number, newTime?: number) => void;
    onDrawingPointDragEnd?: () => void;
    /** Selection callback — toggle selection on a drawing (click on zone) */
    onDrawingSelect?: (drawingId: string | null) => void;
}

export function DrawingLayer({
    chartRef,
    seriesRef,
    containerRef,
    drawings,
    activePreview,
    isFreehand,
    onFreehandStart,
    onFreehandMove,
    onFreehandEnd,
    onDoubleClick,
    onDrawingPointDrag,
    onDrawingPointDragEnd,
    onDrawingSelect,
}: DrawingLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef<{ time: number; price: number } | null>(null);
    const rafRef = useRef(0);

    // Drag state for drawing anchor points
    const dragRef = useRef<{ drawingId: string; pointIndex: number; drawingType: string } | null>(null);
    const isDraggingRef = useRef(false);

    // ── Extrapolation helpers ─────────────────────────────────────
    // Lightweight-charts' timeToCoordinate / coordinateToTime only work
    // for times that exist in the data. These helpers extrapolate using
    // logical coordinates so drawings can extend beyond the candle range.

    /** Convert time → x pixel, interpolating correctly across timeframes */
    const timeToX = useCallback(
        (time: number): number | null => {
            const chart = chartRef.current;
            const series = seriesRef.current;
            if (!chart || !series) return null;

            const ts = chart.timeScale() as unknown as {
                timeToCoordinate(t: unknown): number | null;
                logicalToCoordinate(l: number): number | null;
            };

            // Fast path: time exists exactly in data
            const x = ts.timeToCoordinate(time);
            if (x != null) return x as number;

            // Fallback: binary-search through candle data and interpolate
            // between surrounding bars. This correctly handles times from
            // other timeframes (e.g. a 1m timestamp on a 5m chart).
            const data = (series as unknown as { data(): { time: number }[] }).data?.();
            if (!data || data.length < 2) return null;

            const first = data[0];
            const last = data[data.length - 1];

            // Compute per-bar pixel width from the last two bars
            const prev = data[data.length - 2];
            const lastBarInterval = last.time - prev.time;
            if (lastBarInterval <= 0) return null;
            const lastX = ts.timeToCoordinate(last.time);
            const prevX = ts.timeToCoordinate(prev.time);
            if (lastX == null || prevX == null) return null;
            const pxPerSecond = ((lastX as number) - (prevX as number)) / lastBarInterval;

            // Beyond data range: extrapolate from nearest edge
            if (time <= first.time) {
                const firstX = ts.timeToCoordinate(first.time);
                if (firstX == null) return null;
                return (firstX as number) + (time - first.time) * pxPerSecond;
            }
            if (time >= last.time) {
                return (lastX as number) + (time - last.time) * pxPerSecond;
            }

            // Within data range: binary search for surrounding candles
            let lo = 0;
            let hi = data.length - 1;
            while (lo < hi - 1) {
                const mid = (lo + hi) >> 1;
                if (data[mid].time <= time) lo = mid;
                else hi = mid;
            }

            const loTime = data[lo].time;
            const hiTime = data[hi].time;
            const loX = ts.timeToCoordinate(loTime);
            const hiX = ts.timeToCoordinate(hiTime);
            if (loX == null || hiX == null) return null;

            // Linear interpolation between the two surrounding candles
            const frac = hiTime > loTime ? (time - loTime) / (hiTime - loTime) : 0;
            return (loX as number) + frac * ((hiX as number) - (loX as number));
        },
        [chartRef, seriesRef],
    );

    /** Convert x pixel → time, interpolating correctly across timeframes */
    const xToTime = useCallback(
        (pixelX: number): number | null => {
            const chart = chartRef.current;
            const series = seriesRef.current;
            if (!chart || !series) return null;

            const ts = chart.timeScale() as unknown as {
                coordinateToTime(x: number): unknown | null;
                timeToCoordinate(t: unknown): number | null;
            };

            // Fast path: position corresponds to existing data
            const rawTime = ts.coordinateToTime(pixelX);
            if (typeof rawTime === 'number') return rawTime;

            // Fallback: binary search through pixel positions & interpolate
            const data = (series as unknown as { data(): { time: number }[] }).data?.();
            if (!data || data.length < 2) return null;

            const last = data[data.length - 1];
            const prev = data[data.length - 2];
            const lastBarInterval = last.time - prev.time;
            if (lastBarInterval <= 0) return null;

            const lastX = ts.timeToCoordinate(last.time);
            const prevX = ts.timeToCoordinate(prev.time);
            if (lastX == null || prevX == null) return null;

            const pxPerSecond = ((lastX as number) - (prevX as number)) / lastBarInterval;
            if (pxPerSecond === 0) return null;

            // Beyond data range: extrapolate from nearest edge
            const firstX = ts.timeToCoordinate(data[0].time);
            if (firstX == null) return null;
            if (pixelX <= (firstX as number)) {
                return data[0].time + (pixelX - (firstX as number)) / pxPerSecond;
            }
            if (pixelX >= (lastX as number)) {
                return last.time + (pixelX - (lastX as number)) / pxPerSecond;
            }

            // Within data range: binary search for surrounding candles by pixel X
            let lo = 0;
            let hi = data.length - 1;
            while (lo < hi - 1) {
                const mid = (lo + hi) >> 1;
                const midX = ts.timeToCoordinate(data[mid].time);
                if (midX == null) break;
                if ((midX as number) <= pixelX) lo = mid;
                else hi = mid;
            }

            const loX = ts.timeToCoordinate(data[lo].time);
            const hiX = ts.timeToCoordinate(data[hi].time);
            if (loX == null || hiX == null) return null;

            const span = (hiX as number) - (loX as number);
            const frac = span > 0 ? (pixelX - (loX as number)) / span : 0;
            return data[lo].time + frac * (data[hi].time - data[lo].time);
        },
        [chartRef, seriesRef],
    );

    // Price → Y pixel
    const priceToY = useCallback(
        (price: number): number | null => {
            const s = seriesRef.current;
            if (!s) return null;
            const y = s.priceToCoordinate(price);
            return y == null ? null : (y as number);
        },
        [seriesRef],
    );

    // (time, price) → (x, y) pixel — extrapolates beyond the candle data range.
    const pointToXY = useCallback(
        (time: number, price: number): { x: number; y: number } | null => {
            const series = seriesRef.current;
            if (!series) return null;

            const y = series.priceToCoordinate(price);
            if (y == null) return null;

            const x = timeToX(time);
            if (x == null) return null;

            return { x, y: y as number };
        },
        [seriesRef, timeToX],
    );

    // ── Imperative render ────────────────────────────────────────
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const targetW = Math.round(w * dpr);
        const targetH = Math.round(h * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // Completed drawings
        renderAllDrawings(ctx, drawings, pointToXY, priceToY, w, h);

        // In-progress preview
        if (activePreview && mouseRef.current) {
            const previewObj: DrawingObject = {
                id: '__preview__',
                type: activePreview.type,
                points: [...activePreview.points, mouseRef.current],
                style: { ...activePreview.style, fillOpacity: (activePreview.style.fillOpacity ?? 0.1) * 0.5 },
                visible: true,
                locked: false,
            };
            ctx.globalAlpha = 0.7;
            renderAllDrawings(ctx, [previewObj], pointToXY, priceToY, w, h);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }, [drawings, activePreview, pointToXY, priceToY, containerRef]);

    const scheduleRender = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
    }, [render]);

    // ── Chart event subscriptions for live re-rendering ──────────
    useEffect(() => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;

        const onCrosshairMove = (param: { point?: { x: number; y: number }; time?: unknown }) => {
            if (param.point) {
                const price = series.coordinateToPrice(param.point.y);
                const time = typeof param.time === 'number' ? param.time : 0;
                if (typeof price === 'number' && isFinite(price)) {
                    mouseRef.current = { time, price };
                }
            }
            scheduleRender();
        };

        const onRangeChange = () => scheduleRender();

        chart.subscribeCrosshairMove(onCrosshairMove);
        chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

        return () => {
            chart.unsubscribeCrosshairMove(onCrosshairMove);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
            cancelAnimationFrame(rafRef.current);
        };
        // Re-subscribe when chart instance changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartRef.current, seriesRef.current, scheduleRender]);

    // Re-render when drawings or preview change
    useEffect(() => {
        scheduleRender();
    }, [drawings, activePreview, scheduleRender]);

    // ── Freehand pointer handlers (brush / highlighter) ──────────
    const mouseToDrawingPoint = useCallback(
        (e: React.MouseEvent): DrawingPoint | null => {
            const canvas = canvasRef.current;
            const series = seriesRef.current;
            if (!canvas || !series) return null;
            const rect = canvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const price = series.coordinateToPrice(py);
            if (typeof price !== 'number' || !isFinite(price)) return null;
            const time = xToTime(px);
            if (time == null) return null;
            return { time, price };
        },
        [seriesRef, xToTime],
    );

    /** Hit-test: find if pointer is near a drawing's anchor point (for drag) */
    const hitTestDrawingPoint = useCallback(
        (clientX: number, clientY: number): { drawingId: string; pointIndex: number } | null => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const mx = clientX - rect.left;
            const my = clientY - rect.top;
            const threshold = 12; // px proximity

            for (const d of drawings) {
                if (d.locked || !d.visible || !d.selected) continue;
                if (FREEHAND_TYPES.has(d.type)) continue;

                for (let pi = 0; pi < d.points.length; pi++) {
                    const ptXY = pointToXY(d.points[pi].time, d.points[pi].price);
                    if (!ptXY) continue;
                    const dx = mx - ptXY.x;
                    const dy = my - ptXY.y;
                    if (Math.sqrt(dx * dx + dy * dy) < threshold) {
                        return { drawingId: d.id, pointIndex: pi };
                    }
                }
            }
            return null;
        },
        [drawings, pointToXY],
    );

    /** Hit-test: check if pointer is inside/near any drawing (for selection) */
    const hitTestDrawingZone = useCallback(
        (clientX: number, clientY: number): string | null => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const mx = clientX - rect.left;
            const my = clientY - rect.top;
            const proximity = 8; // px proximity for lines

            for (const d of drawings) {
                if (d.locked || !d.visible) continue;
                if (FREEHAND_TYPES.has(d.type)) continue;
                if (d.points.length === 0) continue;

                // Convert all points to pixels
                const pxPts = d.points.map(p => pointToXY(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
                if (pxPts.length === 0) continue;

                // Single-point drawings (hline, vline, text, etc.): proximity check
                if (pxPts.length === 1) {
                    const dx = mx - pxPts[0].x;
                    const dy = my - pxPts[0].y;
                    if (Math.sqrt(dx * dx + dy * dy) < proximity * 2) return d.id;
                    continue;
                }

                // Two-point line drawings: check distance to line segment
                if (pxPts.length === 2) {
                    const distToSeg = pointToSegmentDist(mx, my, pxPts[0].x, pxPts[0].y, pxPts[1].x, pxPts[1].y);
                    if (distToSeg < proximity) return d.id;
                    // Also check bounding box with padding for area-style drawings
                    const bbLeft = Math.min(pxPts[0].x, pxPts[1].x);
                    const bbRight = Math.max(pxPts[0].x, pxPts[1].x);
                    const bbTop = Math.min(pxPts[0].y, pxPts[1].y);
                    const bbBottom = Math.max(pxPts[0].y, pxPts[1].y);
                    if (bbRight - bbLeft > 20 && bbBottom - bbTop > 20) {
                        // Area drawing: check inside bounding box
                        if (mx >= bbLeft && mx <= bbRight && my >= bbTop && my <= bbBottom) return d.id;
                    }
                    continue;
                }

                // Multi-point drawings: bounding box check
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const pt of pxPts) {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.y > maxY) maxY = pt.y;
                }
                // Check proximity to any segment
                let nearSegment = false;
                for (let i = 0; i < pxPts.length - 1; i++) {
                    if (pointToSegmentDist(mx, my, pxPts[i].x, pxPts[i].y, pxPts[i+1].x, pxPts[i+1].y) < proximity) {
                        nearSegment = true;
                        break;
                    }
                }
                if (nearSegment) return d.id;
                // Bounding box for area drawings
                const pad = proximity;
                if (mx >= minX - pad && mx <= maxX + pad && my >= minY - pad && my <= maxY + pad) return d.id;
            }
            return null;
        },
        [drawings, pointToXY],
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            // Freehand mode only — position drag is handled by container listeners
            if (isFreehand && onFreehandStart) {
                const pt = mouseToDrawingPoint(e as unknown as React.MouseEvent);
                if (!pt) return;
                canvasRef.current?.setPointerCapture(e.pointerId);
                onFreehandStart(pt);
                return;
            }
        },
        [isFreehand, onFreehandStart, mouseToDrawingPoint],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            // Freehand mode only
            if (isFreehand && onFreehandMove) {
                const pt = mouseToDrawingPoint(e as unknown as React.MouseEvent);
                if (pt) onFreehandMove(pt);
                return;
            }
        },
        [isFreehand, onFreehandMove, mouseToDrawingPoint],
    );

    const handlePointerUp = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            canvasRef.current?.releasePointerCapture(e.pointerId);
            if (onFreehandEnd) onFreehandEnd();
        },
        [onFreehandEnd],
    );

    const handleDblClick = useCallback(() => {
        if (onDoubleClick) onDoubleClick();
    }, [onDoubleClick]);

    // ── Container-level native listeners for position drawing interactions ──
    // These run on the chart container and only intercept events when the user
    // clicks/drags on a position drawing zone or handle. Chart panning and
    // scrolling pass through normally.
    useEffect(() => {
        const container = containerRef.current;
        const series = seriesRef.current;
        if (!container || !series) return;

        const onContainerPointerDown = (e: PointerEvent) => {
            // 1. Check for drag handle hit (only on selected drawings)
            if (onDrawingPointDrag) {
                const hit = hitTestDrawingPoint(e.clientX, e.clientY);
                if (hit) {
                    const hitDrawing = drawings.find(dd => dd.id === hit.drawingId);
                    dragRef.current = { ...hit, drawingType: hitDrawing?.type ?? '' };
                    isDraggingRef.current = true;
                    container.setPointerCapture(e.pointerId);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // 2. Check for zone click (select/deselect)
            if (onDrawingSelect) {
                const zoneId = hitTestDrawingZone(e.clientX, e.clientY);
                if (zoneId) {
                    // Only select if not already selected — prevents accidental deselect
                    // when trying to click an anchor point inside the zone
                    const drawing = drawings.find(dd => dd.id === zoneId);
                    if (!drawing?.selected) {
                        onDrawingSelect(zoneId);
                    }
                    // Don't stop propagation — let chart still handle the event
                    return;
                }
                // Clicked outside all zones — deselect any selected drawing
                if (drawings.some(dd => dd.selected)) {
                    onDrawingSelect(null);
                }
            }
        };

        const onContainerPointerMove = (e: PointerEvent) => {
            if (!isDraggingRef.current || !dragRef.current || !onDrawingPointDrag) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const newPrice = series.coordinateToPrice(y);
            if (typeof newPrice === 'number' && isFinite(newPrice)) {
                // Update both time and price for all drawing types
                let newTime: number | undefined;
                const px = e.clientX - rect.left;
                const extrapolated = xToTime(px);
                if (extrapolated != null) newTime = extrapolated;
                onDrawingPointDrag(dragRef.current.drawingId, dragRef.current.pointIndex, newPrice, newTime);
            }
            e.preventDefault();
            e.stopPropagation();
        };

        const onContainerPointerUp = (e: PointerEvent) => {
            if (isDraggingRef.current) {
                try { container.releasePointerCapture(e.pointerId); } catch { /* ok */ }
                isDraggingRef.current = false;
                dragRef.current = null;
                if (onDrawingPointDragEnd) onDrawingPointDragEnd();
            }
        };

        container.addEventListener('pointerdown', onContainerPointerDown, true);
        container.addEventListener('pointermove', onContainerPointerMove, true);
        container.addEventListener('pointerup', onContainerPointerUp, true);

        return () => {
            container.removeEventListener('pointerdown', onContainerPointerDown, true);
            container.removeEventListener('pointermove', onContainerPointerMove, true);
            container.removeEventListener('pointerup', onContainerPointerUp, true);
        };
    }, [containerRef, seriesRef, chartRef, drawings, hitTestDrawingPoint, hitTestDrawingZone,
        onDrawingPointDrag, onDrawingPointDragEnd, onDrawingSelect, xToTime]);

    return (
        <canvas
            ref={canvasRef}
            onPointerDown={isFreehand ? handlePointerDown : undefined}
            onPointerMove={isFreehand ? handlePointerMove : undefined}
            onPointerUp={isFreehand ? handlePointerUp : undefined}
            onDoubleClick={handleDblClick}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: isFreehand ? 'auto' : 'none',
                zIndex: 5,
                cursor: isFreehand ? 'crosshair' : undefined,
            }}
        />
    );
}
