import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { ISeriesApi, IChartApi, IPriceLine } from 'lightweight-charts';

export interface OverlayAlert {
    id: string;
    symbol: string;
    targetPrice: number;
    triggered?: boolean;
}

interface DraggableAlertOverlayProps {
    alerts: OverlayAlert[];
    activeSymbol: string;
    priceDecimals: number;
    chartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onDelete: (id: string) => void;
    onUpdatePrice: (id: string, newPrice: number) => Promise<any>;
}

export function DraggableAlertOverlay({
    alerts,
    activeSymbol,
    priceDecimals,
    chartRef,
    seriesRef,
    containerRef,
    onDelete,
    onUpdatePrice,
}: DraggableAlertOverlayProps) {
    const [positions, setPositions] = useState<{ id: string; y: number; label: string }[]>([]);
    const rafRef = useRef(0);
    const alertLinesRef = useRef<Map<string, IPriceLine>>(new Map());

    // Filter alerts to active symbol and untriggered
    const activeAlerts = useMemo(
        () => alerts.filter(a => a.symbol === activeSymbol && !a.triggered),
        [alerts, activeSymbol],
    );

    // Keep ref up to date for handlers to avoid closures
    const alertsRef = useRef(activeAlerts);
    alertsRef.current = activeAlerts;

    // ─── Render Price Lines on the Chart ───
    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;

        const currentIds = new Set(activeAlerts.map(a => a.id));

        // Remove lines for alerts that no longer exist
        for (const [id, line] of alertLinesRef.current) {
            if (!currentIds.has(id)) {
                try { series.removePriceLine(line); } catch {}
                alertLinesRef.current.delete(id);
            }
        }

        // Add/update lines for current alerts
        for (const alert of activeAlerts) {
            const title = `${alert.symbol} Crossing ${alert.targetPrice.toFixed(priceDecimals)}`;
            if (alertLinesRef.current.has(alert.id)) {
                try {
                    alertLinesRef.current.get(alert.id)!.applyOptions({ price: alert.targetPrice, title });
                } catch {}
            } else {
                try {
                    const line = series.createPriceLine({
                        price: alert.targetPrice,
                        color: '#f59e0b',
                        lineWidth: 1,
                        lineStyle: 1, // Dashed
                        axisLabelVisible: true,
                        title,
                    });
                    alertLinesRef.current.set(alert.id, line);
                } catch {}
            }
        }
    }, [activeAlerts, activeSymbol, priceDecimals, seriesRef]);

    // Clean up all alert lines when chart is destroyed / symbol changes
    useEffect(() => {
        return () => {
            const series = seriesRef.current;
            if (series) {
                for (const [, line] of alertLinesRef.current) {
                    try { series.removePriceLine(line); } catch {}
                }
            }
            alertLinesRef.current.clear();
        };
    }, [activeSymbol, seriesRef]);


    // ─── Overlay Buttons Position sync ───
    const computePositions = useCallback(() => {
        const series = seriesRef.current;
        if (!series || alertsRef.current.length === 0) {
            setPositions(prev => (prev.length === 0 ? prev : []));
            return;
        }
        const pos: { id: string; y: number; label: string }[] = [];
        for (const alert of alertsRef.current) {
            const y = series.priceToCoordinate(alert.targetPrice);
            if (y !== null && typeof y === 'number' && isFinite(y)) {
                pos.push({
                    id: alert.id,
                    y,
                    label: `${alert.symbol} Crossing ${alert.targetPrice}`,
                });
            }
        }
        setPositions(prev => {
            if (prev.length !== pos.length) return pos;
            for (let i = 0; i < pos.length; i++) {
                if (prev[i].id !== pos[i].id || Math.abs(prev[i].y - pos[i].y) > 0.5) return pos;
            }
            return prev; // no change
        });
    }, [seriesRef]);

    // Recompute when alerts change
    useEffect(() => {
        computePositions();
    }, [activeAlerts, computePositions]);

    // Recompute when chart scrolls/zooms (not on every mouse move)
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const onRangeChange = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(computePositions);
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
        return () => {
            cancelAnimationFrame(rafRef.current);
            try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange); } catch {}
        };
    }, [chartRef, computePositions]);


    // ─── Drag interaction for alert price lines ───
    const draggingAlertRef = useRef<{ id: string; startY: number } | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        const series = seriesRef.current;
        if (!container || !series) return;

        const SNAP_PX = 6; // px threshold to start drag

        const findAlertAtY = (clientY: number): { id: string; alertObj: OverlayAlert } | null => {
            const rect = container.getBoundingClientRect();
            const localY = clientY - rect.top;
            for (const alert of alertsRef.current) {
                const lineY = series.priceToCoordinate(alert.targetPrice);
                if (lineY !== null && typeof lineY === 'number' && Math.abs(lineY - localY) <= SNAP_PX) {
                    return { id: alert.id, alertObj: alert };
                }
            }
            return null;
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return; // left click only
            const hit = findAlertAtY(e.clientY);
            if (hit) {
                e.preventDefault();
                e.stopPropagation();
                draggingAlertRef.current = { id: hit.id, startY: e.clientY };
                container.style.cursor = 'ns-resize';
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!draggingAlertRef.current) {
                // Show resize cursor when hovering near an alert line
                const hit = findAlertAtY(e.clientY);
                const rect = container.getBoundingClientRect();
                const localX = e.clientX - rect.left;
                const psWidth = 60;
                const chartArea = rect.width - psWidth;
                if (hit && localX < chartArea) {
                    container.style.cursor = 'ns-resize';
                } else if (container.style.cursor === 'ns-resize') {
                    container.style.cursor = '';
                }
                return;
            }

            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const localY = e.clientY - rect.top;
            const price = series.coordinateToPrice(localY);
            if (typeof price === 'number' && isFinite(price) && price > 0) {
                const line = alertLinesRef.current.get(draggingAlertRef.current.id);
                if (line) {
                    const title = `${activeSymbol} Crossing ${price.toFixed(priceDecimals)}`;
                    line.applyOptions({ price, title });
                }
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (!draggingAlertRef.current) return;
            container.style.cursor = '';
            const dragInfo = draggingAlertRef.current;
            draggingAlertRef.current = null;

            const rect = container.getBoundingClientRect();
            const localY = e.clientY - rect.top;
            const newPrice = series.coordinateToPrice(localY);
            if (typeof newPrice === 'number' && isFinite(newPrice) && newPrice > 0) {
                const rounded = parseFloat(newPrice.toFixed(priceDecimals));
                onUpdatePrice(dragInfo.id, rounded).then(() => {
                    toast.success(`Alert moved to ${activeSymbol} @ ${rounded}`);
                }).catch(() => {
                    // Revert visual on failure
                    const orig = alertsRef.current.find(a => a.id === dragInfo.id);
                    const line = alertLinesRef.current.get(dragInfo.id);
                    if (orig && line) {
                        line.applyOptions({ price: orig.targetPrice, title: `${orig.symbol} Crossing ${orig.targetPrice.toFixed(priceDecimals)}` });
                    }
                });
            }
        };

        // Use capture to handle before drawing layer / chart click handlers
        container.addEventListener('mousedown', onMouseDown, true);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            container.removeEventListener('mousedown', onMouseDown, true);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            container.style.cursor = '';
        };
    }, [activeSymbol, priceDecimals, onUpdatePrice, containerRef, seriesRef]);

    if (positions.length === 0) return null;

    return (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
            {positions.map(p => (
                <button
                    key={p.id}
                    onClick={() => onDelete(p.id)}
                    title={`Delete alert: ${p.label}`}
                    className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono
                        bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-red-500/30 hover:text-red-400
                        hover:border-red-500/40 transition-colors cursor-pointer backdrop-blur-sm pointer-events-auto"
                    style={{
                        right: 72,
                        top: p.y - 10,
                    }}
                >
                    <Trash2 size={10} />
                </button>
            ))}
        </div>
    );
}
