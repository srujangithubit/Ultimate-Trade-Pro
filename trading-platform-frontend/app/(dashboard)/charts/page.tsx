'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import TopBar from '@/components/charts/TopBar';
import ChartGrid from '@/components/charts/ChartGrid';
import RightPanel from '@/components/charts/RightPanel';
import BottomPanel from '@/components/charts/BottomPanel';
import ReplayControls from '@/components/charts/ReplayControls';
import ChartToolbar from '@/components/backtesting/TradingViewToolbar';
import { DrawingLayer } from '@/components/backtesting/DrawingLayer';
import { DrawingToolbar } from '@/components/backtesting/DrawingToolbar';
import { FibSettingsDialog } from '@/components/backtesting/FibSettingsDialog';
import { PriceScaleMenu } from '@/components/backtesting/PriceScaleMenu';
import { DraggableAlertOverlay } from '@/components/charts/DraggableAlertOverlay';
import { useChartDrawings } from '@/lib/hooks/useChartDrawings';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useMT5 } from '@/components/mt5/MT5Context';
import { usePriceAlerts } from '@/lib/hooks/usePriceAlerts';
import { toast } from 'sonner';
import type { IChartApi, ISeriesApi, IPriceLine } from 'lightweight-charts';
import type { ConnectionStatus } from '@/lib/types/trading';
import type { PriceAlert } from '@/lib/hooks/usePriceAlerts';
import { Trash2 } from 'lucide-react';

function getPriceDecimals(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s.includes('JPY')) return 3;
    if (s.startsWith('XAU')) return 2;
    if (s.startsWith('BTC') || s.startsWith('ETH')) return 2;
    if (['US500', 'NAS100', 'US30', 'GER40', 'UK100'].some(i => s.startsWith(i))) return 1;
    return 5; // forex default
}

export default function ChartsPage() {
    const [gridMode, setGridMode] = useState<'1x1' | '2x2'>('1x1');
    const [rightPanelTab, setRightPanelTab] = useState<string | undefined>(undefined);
    const { activeSymbol, timeframe, replayActive } = useTradingStore();
    const mt5 = useMT5();
    const { alerts, createAlert, deleteAlert, updateAlert } = usePriceAlerts();

    // Derive connection status from MT5
    const connectionStatus: ConnectionStatus = mt5.status.connected ? 'connected' : 'disconnected';

    // Measure tick freshness (time since last tick arrived)
    const [latencyMs, setLatencyMs] = useState(0);
    const lastTickArrivalRef = useRef(0);

    // ─── Chart refs for drawing layer & price scale menu ───
    const chartInstance = useRef<IChartApi | null>(null);
    const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const [chartReady, setChartReady] = useState(false);

    // ─── Drawing tools (shared hook — full destructuring) ───
    const {
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
        drawings,
        activePreview,
        addDrawing,
        updateDrawingPoint,
        commitDrawingUpdate,
        toggleDrawingSelection,
        updateDrawing,
        deleteDrawing,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useChartDrawings();

    const isFreehandMode = activeTool === 'brush' || activeTool === 'highlighter';

    // ─── Drawing settings dialog state ───
    const [settingsDrawingId, setSettingsDrawingId] = useState<string | null>(null);
    const selectedDrawing = drawings.find(d => d.selected) ?? null;
    const settingsDrawing = drawings.find(d => d.id === settingsDrawingId) ?? null;

    const priceDecimals = getPriceDecimals(activeSymbol);

    const handleChartReady = useCallback((refs: { chart: any; series: any; container: HTMLDivElement }) => {
        chartInstance.current = refs.chart;
        candleSeries.current = refs.series;
        chartContainerRef.current = refs.container;
        setChartRefs(refs.chart, refs.series);
        setChartReady(true);
    }, [setChartRefs]);

    // ─── PriceScaleMenu callbacks ───
    const handlePriceScaleDrawHLine = useCallback((price: number) => {
        addDrawing({
            type: 'hline',
            points: [{ price, time: 0 }],
            style: { color: '#787B86', lineWidth: 1, lineStyle: 'dashed' },
        });
    }, [addDrawing]);

    const handlePriceScaleAddAlert = useCallback((price: number) => {
        createAlert(activeSymbol, price);
        toast.success(`Alert set: ${activeSymbol} @ ${price}`);
    }, [createAlert, activeSymbol]);

    const handlePriceScaleAddOrder = useCallback((price: number) => {
        console.log(`[Charts] Add order at ${price}`);
    }, []);

    const handlePriceScaleSellLimit = useCallback((price: number) => {
        console.log(`[Charts] Sell limit at ${price}`);
    }, []);

    const handlePriceScaleBuyStop = useCallback((price: number) => {
        console.log(`[Charts] Buy stop at ${price}`);
    }, []);

    useEffect(() => {
        const tick = mt5.ticks[activeSymbol];
        if (tick) {
            const now = Date.now();
            if (lastTickArrivalRef.current > 0) {
                const gap = now - lastTickArrivalRef.current;
                setLatencyMs(Math.min(gap, 9999));
            }
            lastTickArrivalRef.current = now;
        }
    }, [mt5.ticks, activeSymbol]);

    // Subscribe to the active symbol on MT5
    useEffect(() => {
        mt5.subscribe(activeSymbol);
        return () => {
            mt5.unsubscribe(activeSymbol);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSymbol]);

    return (
        <div className="h-[calc(100vh-56px)] flex flex-col bg-background overflow-hidden">
            {/* Top Bar — 48px */}
            <TopBar
                gridMode={gridMode}
                onGridModeToggle={() => setGridMode((m) => (m === '1x1' ? '2x2' : '1x1'))}
                connectionStatus={connectionStatus}
                latencyMs={latencyMs}
                onAlertClick={() => setRightPanelTab('alerts')}
            />

            {/* Replay Controls — conditional */}
            <ReplayControls />

            {/* Main area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Drawing Toolbar */}
                <ChartToolbar
                    activeTool={activeTool}
                    onToolChange={handleToolChange}
                    pendingClick={pendingClick}
                    isLocked={isLocked}
                    isMagnet={isMagnet}
                    isVisible={isVisible}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                />

                {/* Chart Grid + Drawing Overlays */}
                <div className="flex-1 min-w-0 relative">
                    <ChartGrid
                        mode={gridMode}
                        onChartReady={handleChartReady}
                        onChartClick={handleChartClick}
                        drawingMode={isDrawingMode}
                    />

                    {/* Drawing canvas overlay */}
                    <DrawingLayer
                        chartRef={chartInstance}
                        seriesRef={candleSeries}
                        containerRef={chartContainerRef}
                        drawings={drawings}
                        activePreview={activePreview}
                        isFreehand={isFreehandMode}
                        onFreehandStart={handleFreehandStart}
                        onFreehandMove={handleFreehandMove}
                        onFreehandEnd={handleFreehandEnd}
                        onDoubleClick={handleChartDoubleClick}
                        onDrawingPointDrag={updateDrawingPoint}
                        onDrawingPointDragEnd={commitDrawingUpdate}
                        onDrawingSelect={toggleDrawingSelection}
                    />

                    {/* Drawing floating toolbar */}
                    {selectedDrawing && (
                        <DrawingToolbar
                            drawing={selectedDrawing}
                            onOpenSettings={(id) => setSettingsDrawingId(id)}
                            onDelete={(id) => { deleteDrawing(id); toggleDrawingSelection(null); }}
                            onToggleLock={(id) => updateDrawing(id, { locked: !selectedDrawing.locked })}
                            onToggleVisibility={(id) => updateDrawing(id, { visible: !selectedDrawing.visible })}
                            onStyleChange={(id, updates) => updateDrawing(id, updates)}
                        />
                    )}

                    {/* Fib settings dialog (modal) */}
                    {settingsDrawing && (settingsDrawing.type === 'fibonacci' || settingsDrawing.type === 'fib-trend-ext') && (
                        <FibSettingsDialog
                            drawing={settingsDrawing}
                            onApply={(id, updates) => { updateDrawing(id, updates); setSettingsDrawingId(null); }}
                            onClose={() => setSettingsDrawingId(null)}
                        />
                    )}

                    {/* Alert line delete buttons overlay */}
                    <DraggableAlertOverlay
                        alerts={alerts}
                        activeSymbol={activeSymbol}
                        priceDecimals={priceDecimals}
                        chartRef={chartInstance}
                        seriesRef={candleSeries}
                        containerRef={chartContainerRef}
                        onDelete={deleteAlert}
                        onUpdatePrice={(id, newPrice) => updateAlert(id, newPrice)}
                    />

                    {/* Price Scale context menu — only mount after chart refs are ready */}
                    {chartReady && (
                        <PriceScaleMenu
                            chartRef={chartInstance}
                            seriesRef={candleSeries}
                            containerRef={chartContainerRef}
                            instrument={activeSymbol}
                            priceDecimals={priceDecimals}
                            orderVolume={0.1}
                            onSellLimit={handlePriceScaleSellLimit}
                            onBuyStop={handlePriceScaleBuyStop}
                            onAddOrder={handlePriceScaleAddOrder}
                            onAddAlert={handlePriceScaleAddAlert}
                            onDrawHLine={handlePriceScaleDrawHLine}
                        />
                    )}
                </div>

                {/* Right Panel — 320px */}
                <RightPanel
                    initialTab={rightPanelTab}
                    onTabConsumed={() => setRightPanelTab(undefined)}
                    alerts={alerts}
                    onCreateAlert={createAlert}
                    onDeleteAlert={deleteAlert}
                />
            </div>

            {/* Bottom Panel — 240px resizable */}
            <BottomPanel />
        </div>
    );
}
