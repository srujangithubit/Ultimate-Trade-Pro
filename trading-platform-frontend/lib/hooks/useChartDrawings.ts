import { useState, useCallback, useRef, useEffect } from 'react';
import { CrosshairMode, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '@/lib/drawing/types';
import { TOOLS, NON_DRAWING_IDS, SHORTCUT_MAP, type DrawingToolId } from '@/lib/drawing/tools';
import { api } from '@/lib/api/client';

// Re-export DrawingToolId as DrawingTool for backward compat
export type DrawingTool = DrawingToolId;

let _drawingId = 0;
function nextId() { return `d_${++_drawingId}_${Date.now()}`; }

/** Single-click tools that complete in one click */
const SINGLE_CLICK_TOOLS = new Set<string>([
    'hline', 'vline', 'cross-line', 'text', 'anchored-text', 'price-label',
    'arrow-marker', 'arrow-up', 'arrow-down', 'flag-mark', 'note', 'signpost',
    'anchored-vwap', 'anchored-vol-profile',
]);

/** Tools that need a text prompt on placement */
const TEXT_PROMPT_TOOLS = new Set<string>(['text', 'anchored-text', 'note', 'callout']);

/**
 * Canvas-based chart drawing tools hook.
 *
 * All drawings are stored as DrawingObjects and rendered via a canvas overlay
 * (DrawingLayer component). Undo/redo, keyboard shortcuts, and multi-click
 * tools are supported out of the box.
 *
 * Call `setChartRefs(chart, series)` once after chart creation.
 * Wire `handleChartClick` via `registerChartClick`.
 */
export function useChartDrawings(sessionId?: string) {
    /* ── Visible React state ─────────────────────────────────────── */
    const [activeTool, setActiveToolState] = useState<DrawingToolId>('cursor');
    const [pendingClick, setPendingClick] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isMagnet, setIsMagnet] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    /* ── Drawing objects (ref = source of truth, state = render trigger) */
    const drawingsRef = useRef<DrawingObject[]>([]);
    const [drawings, setDrawingsState] = useState<DrawingObject[]>([]);

    /* ── Preview for in-progress drawing ─────────────────────────── */
    const [activePreview, setActivePreview] = useState<{
        type: string; points: DrawingPoint[]; style: DrawingStyle;
    } | null>(null);

    /* ── Freehand state ──────────────────────────────────────────── */
    const freehandRef = useRef<DrawingPoint[]>([]);
    const freehandActive = useRef(false);

    /* ── Undo / redo history ─────────────────────────────────────── */
    const historyRef = useRef<DrawingObject[][]>([[]]);
    const historyIdxRef = useRef(0);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    /* ── Internal refs ───────────────────────────────────────────── */
    const activeToolRef = useRef<DrawingToolId>('cursor');
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const pendingPointsRef = useRef<DrawingPoint[]>([]);
    const isLockedRef = useRef(false);
    const isMagnetRef = useRef(false);
    const isVisibleRef = useRef(true);

    /* ── Helpers ──────────────────────────────────────────────────── */
    const setActiveTool = useCallback((tool: DrawingToolId) => {
        activeToolRef.current = tool;
        setActiveToolState(tool);
    }, []);

    const pushState = useCallback((next: DrawingObject[]) => {
        drawingsRef.current = next;
        historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
        historyRef.current.push(next);
        historyIdxRef.current = historyRef.current.length - 1;
        setDrawingsState(next);
        setCanUndo(historyIdxRef.current > 0);
        setCanRedo(false);
    }, []);

    const addDrawing = useCallback((partial: Omit<DrawingObject, 'id' | 'visible' | 'locked'>) => {
        const obj: DrawingObject = { ...partial, id: nextId(), visible: true, locked: false };
        pushState([...drawingsRef.current, obj]);
    }, [pushState]);

    /* ── Persistence: load drawings on mount, auto-save on changes ── */
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedRef = useRef(false);

    // Load drawings from backend when sessionId is available
    useEffect(() => {
        if (!sessionId) return;
        let cancelled = false;
        api.get(`/backtesting/sessions/${sessionId}/drawings`).then(res => {
            if (cancelled || !Array.isArray(res.data)) return;
            const loaded: DrawingObject[] = res.data.map((d: Record<string, unknown>) => ({
                id: String(d.id || nextId()),
                type: String(d.type || 'unknown'),
                points: (d.points as DrawingPoint[]) || [],
                style: (d.style as DrawingStyle) || { color: '#ffffff', lineWidth: 1, lineStyle: 'solid' as const },
                text: d.text as string | undefined,
                visible: d.visible !== false,
                locked: d.locked === true,
                selected: false,
                freehandPoints: d.freehandPoints as DrawingPoint[] | undefined,
                labels: d.labels as string[] | undefined,
                config: d.config as DrawingObject['config'],
            }));
            if (loaded.length > 0) {
                drawingsRef.current = loaded;
                historyRef.current = [loaded];
                historyIdxRef.current = 0;
                setDrawingsState(loaded);
            }
            loadedRef.current = true;
        }).catch(() => {
            loadedRef.current = true;
        });
        return () => { cancelled = true; };
    }, [sessionId]);

    // Auto-save drawings to backend (debounced)
    useEffect(() => {
        if (!sessionId || !loadedRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const toSave = drawingsRef.current
                .filter(d => d.id !== '__preview__')
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .map(({ selected: _sel, ...rest }) => rest);
            api.patch(`/backtesting/sessions/${sessionId}/drawings`, toSave).catch(() => {});
        }, 1500);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [sessionId, drawings]);

    /** Update a single point within a drawing (used for drag-to-adjust) */
    const updateDrawingPoint = useCallback((drawingId: string, pointIndex: number, newPrice: number, newTime?: number) => {
        const updated = drawingsRef.current.map(d => {
            if (d.id !== drawingId || d.locked) return d;
            const pts = d.points.map((p, i) => {
                if (i !== pointIndex) return p;
                return { ...p, price: newPrice, ...(newTime !== undefined ? { time: newTime } : {}) };
            });
            return { ...d, points: pts };
        });
        // Direct update without pushing to undo history (for live dragging)
        drawingsRef.current = updated;
        setDrawingsState(updated);
    }, []);

    /** Commit the dragged state to undo history (call on drag end) */
    const commitDrawingUpdate = useCallback(() => {
        pushState([...drawingsRef.current]);
    }, [pushState]);

    /** Toggle selection on a drawing (deselects all others) */
    const toggleDrawingSelection = useCallback((drawingId: string | null) => {
        const updated = drawingsRef.current.map(d => ({
            ...d,
            selected: drawingId !== null && d.id === drawingId ? !d.selected : false,
        }));
        drawingsRef.current = updated;
        setDrawingsState(updated);
    }, []);

    /** Update arbitrary fields on a drawing (e.g. config, style, locked, visible) */
    const updateDrawing = useCallback((drawingId: string, updates: Partial<DrawingObject>) => {
        const next = drawingsRef.current.map(d =>
            d.id === drawingId ? { ...d, ...updates } : d,
        );
        pushState(next);
    }, [pushState]);

    /** Delete a drawing by id */
    const deleteDrawing = useCallback((drawingId: string) => {
        pushState(drawingsRef.current.filter(d => d.id !== drawingId));
    }, [pushState]);

    const undo = useCallback(() => {
        if (historyIdxRef.current > 0) {
            historyIdxRef.current--;
            const prev = historyRef.current[historyIdxRef.current];
            drawingsRef.current = prev;
            setDrawingsState(prev);
            setCanUndo(historyIdxRef.current > 0);
            setCanRedo(true);
        }
    }, []);

    const redo = useCallback(() => {
        if (historyIdxRef.current < historyRef.current.length - 1) {
            historyIdxRef.current++;
            const next = historyRef.current[historyIdxRef.current];
            drawingsRef.current = next;
            setDrawingsState(next);
            setCanUndo(true);
            setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
        }
    }, []);

    /** Call after the chart (re-)mounts */
    const setChartRefs = useCallback(
        (chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null) => {
            chartRef.current = chart;
            seriesRef.current = series;
        },
        [],
    );

    /* ── Tool selection (toolbar clicks) ─────────────────────────── */
    const handleToolChange = useCallback(
        (tool: DrawingToolId) => {
            const chart = chartRef.current;

            // ── Action tools (fire-and-forget) ──
            if (tool === 'trash') {
                pushState([]);
                return;
            }
            if (tool === 'eraser') {
                if (drawingsRef.current.length > 0) {
                    pushState(drawingsRef.current.slice(0, -1));
                }
                return;
            }
            if (tool === 'lock') {
                isLockedRef.current = !isLockedRef.current;
                setIsLocked(isLockedRef.current);
                return;
            }
            if (tool === 'show-hide') {
                isVisibleRef.current = !isVisibleRef.current;
                setIsVisible(isVisibleRef.current);
                const toggled = drawingsRef.current.map(d => ({ ...d, visible: isVisibleRef.current }));
                drawingsRef.current = toggled;
                setDrawingsState(toggled);
                return;
            }
            if (tool === 'zoom-in' || tool === 'zoom-out') {
                if (chart) {
                    const range = chart.timeScale().getVisibleLogicalRange();
                    if (range) {
                        const center = (range.from + range.to) / 2;
                        const span = range.to - range.from;
                        const factor = tool === 'zoom-in' ? 0.5 : 2;
                        const half = (span * factor) / 2;
                        chart.timeScale().setVisibleLogicalRange({ from: center - half, to: center + half });
                    }
                }
                return;
            }
            if (tool === 'magnet') {
                isMagnetRef.current = !isMagnetRef.current;
                setIsMagnet(isMagnetRef.current);
                if (chart) {
                    chart.applyOptions({
                        crosshair: {
                            mode: isMagnetRef.current ? CrosshairMode.Magnet : CrosshairMode.Normal,
                        },
                    });
                }
                return;
            }

            // ── Drawing / navigation tools ──
            pendingPointsRef.current = [];
            freehandRef.current = [];
            freehandActive.current = false;
            setPendingClick(false);
            setActivePreview(null);

            if (chart) {
                if (tool === 'crosshair') {
                    chart.applyOptions({ crosshair: { mode: CrosshairMode.Magnet } });
                } else if (activeToolRef.current === 'crosshair') {
                    chart.applyOptions({
                        crosshair: {
                            mode: isMagnetRef.current ? CrosshairMode.Magnet : CrosshairMode.Normal,
                        },
                    });
                }
            }

            setActiveTool(tool);
        },
        [setActiveTool, pushState],
    );

    /* ── Chart click handler (receives price + time) ─────────────── */
    const handleChartClick = useCallback(
        (price: number, time?: number) => {
            if (isLockedRef.current) return;
            const tool = activeToolRef.current;
            if (NON_DRAWING_IDS.has(tool)) return;

            const meta = TOOLS[tool];
            if (!meta || meta.clicks === 0) return;

            const clickTime = time ?? Math.floor(Date.now() / 1000);
            const point: DrawingPoint = { time: clickTime, price };
            const style: DrawingStyle = { ...meta.style };

            // ── Freehand tools (brush / highlighter) ──
            if (meta.clicks === -1) {
                // Start handled by mousedown → freehand tracking in DrawingLayer
                return;
            }

            // ── Single-click tools ──
            if (SINGLE_CLICK_TOOLS.has(tool)) {
                let drawText: string | undefined;
                if (TEXT_PROMPT_TOOLS.has(tool)) {
                    const label = prompt('Enter text:');
                    if (!label) { setActiveTool('cursor'); return; }
                    drawText = label;
                }
                addDrawing({ type: tool, points: [point], style, text: drawText });
                setActiveTool('cursor');
                return;
            }

            // ── Polyline (double-click to finish, 99 = unlimited) ──
            if (meta.clicks === 99) {
                pendingPointsRef.current.push(point);
                setPendingClick(true);
                setActivePreview({ type: tool, points: [...pendingPointsRef.current], style });
                return;
            }

            // ── Multi-click tools ──
            pendingPointsRef.current.push(point);

            if (pendingPointsRef.current.length < meta.clicks) {
                setPendingClick(true);
                setActivePreview({
                    type: tool,
                    points: [...pendingPointsRef.current],
                    style,
                });
            } else {
                addDrawing({
                    type: tool,
                    points: [...pendingPointsRef.current],
                    style,
                });
                pendingPointsRef.current = [];
                setPendingClick(false);
                setActivePreview(null);
                setActiveTool('cursor');
            }
        },
        [addDrawing, setActiveTool],
    );

    /* ── Double-click handler for polyline finish ────────────────── */
    const handleChartDoubleClick = useCallback(() => {
        const tool = activeToolRef.current;
        const meta = TOOLS[tool];
        if (meta?.clicks === 99 && pendingPointsRef.current.length >= 2) {
            addDrawing({
                type: tool,
                points: [...pendingPointsRef.current],
                style: { ...meta.style },
            });
            pendingPointsRef.current = [];
            setPendingClick(false);
            setActivePreview(null);
            setActiveTool('cursor');
        }
    }, [addDrawing, setActiveTool]);

    /* ── Freehand drawing support (brush / highlighter) ──────────── */
    const handleFreehandStart = useCallback((point: DrawingPoint) => {
        const tool = activeToolRef.current;
        const meta = TOOLS[tool];
        if (!meta || meta.clicks !== -1) return;
        freehandActive.current = true;
        freehandRef.current = [point];
    }, []);

    const handleFreehandMove = useCallback((point: DrawingPoint) => {
        if (!freehandActive.current) return;
        freehandRef.current.push(point);
    }, []);

    const handleFreehandEnd = useCallback(() => {
        if (!freehandActive.current) return;
        freehandActive.current = false;
        const tool = activeToolRef.current;
        const meta = TOOLS[tool];
        if (freehandRef.current.length >= 2 && meta) {
            addDrawing({
                type: tool,
                points: [freehandRef.current[0], freehandRef.current[freehandRef.current.length - 1]],
                style: { ...meta.style },
                freehandPoints: [...freehandRef.current],
            });
        }
        freehandRef.current = [];
    }, [addDrawing]);

    /* ── Keyboard shortcuts ──────────────────────────────────────── */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Escape') {
                pendingPointsRef.current = [];
                freehandRef.current = [];
                freehandActive.current = false;
                setPendingClick(false);
                setActivePreview(null);
                setActiveTool('cursor');
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
                return;
            }

            if (e.key === 'Delete') {
                if (drawingsRef.current.length > 0) {
                    pushState(drawingsRef.current.slice(0, -1));
                }
                return;
            }

            const tool = SHORTCUT_MAP[e.key.toLowerCase()];
            if (tool) handleToolChange(tool);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setActiveTool, undo, redo, pushState, handleToolChange]);

    const isDrawingMode =
        activeTool !== 'cursor' && activeTool !== 'crosshair' && activeTool !== 'dot'
        && !NON_DRAWING_IDS.has(activeTool);

    return {
        activeTool,
        isDrawingMode,
        pendingClick,
        isLocked,
        isMagnet,
        isVisible,
        handleToolChange,
        handleChartClick,
        handleChartDoubleClick,
        handleFreehandStart,
        handleFreehandMove,
        handleFreehandEnd,
        setChartRefs,
        // Canvas drawing state
        drawings,
        activePreview,
        // Direct drawing creation (used by PriceScaleMenu etc.)
        addDrawing,
        // Drawing mutation (for drag-to-adjust)
        updateDrawingPoint,
        commitDrawingUpdate,
        // Selection
        toggleDrawingSelection,
        // Drawing-level updates
        updateDrawing,
        deleteDrawing,
        // Undo / redo
        undo,
        redo,
        canUndo,
        canRedo,
    };
}
