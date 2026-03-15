'use client';

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

// ── Types ────────────────────────────────────────────────────────────────

interface PriceScaleMenuProps {
    chartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    instrument: string;
    priceDecimals: number;
    orderVolume: number;
    onBuyStop: (price: number) => void;
    onSellLimit: (price: number) => void;
    onAddOrder: (price: number) => void;
    onAddAlert: (price: number) => void;
    onDrawHLine: (price: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatPrice(price: number, decimals: number): string {
    return price.toFixed(decimals);
}

// ── Component ────────────────────────────────────────────────────────────

export function PriceScaleMenu({
    chartRef,
    seriesRef,
    containerRef,
    instrument,
    priceDecimals,
    orderVolume,
    onBuyStop,
    onSellLimit,
    onAddOrder,
    onAddAlert,
    onDrawHLine,
}: PriceScaleMenuProps) {
    // ── State ──
    const [hoverPrice, setHoverPrice] = useState<number | null>(null);
    const [hoverY, setHoverY] = useState<number>(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPrice, setMenuPrice] = useState<number>(0);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Overlay position/size state
    const [overlayRect, setOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

    // ── Detect price scale width ──
    const getPriceScaleWidth = useCallback((): number => {
        const chart = chartRef.current;
        if (!chart) return 60;
        try {
            const ps = chart.priceScale('right');
            if (ps && typeof (ps as unknown as { width: () => number }).width === 'function') {
                return (ps as unknown as { width: () => number }).width();
            }
        } catch { /* fallback */ }
        return 60;
    }, [chartRef]);

    // ── Position the overlay on top of the price scale ──
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateOverlay = () => {
            const rect = container.getBoundingClientRect();
            const psWidth = getPriceScaleWidth();
            setOverlayRect({
                left: rect.left + rect.width - psWidth,
                top: rect.top,
                width: psWidth,
                height: rect.height,
            });
        };

        updateOverlay();
        const interval = setInterval(updateOverlay, 500);
        window.addEventListener('resize', updateOverlay);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateOverlay);
        };
    }, [containerRef, getPriceScaleWidth]);

    // ── Overlay mouse events ──
    const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
        if (menuOpen) return;
        const series = seriesRef.current;
        if (!series || !overlayRect) return;

        const localY = e.clientY - overlayRect.top;
        try {
            const price = series.coordinateToPrice(localY);
            if (typeof price === 'number' && isFinite(price) && price > 0) {
                setHoverPrice(price);
                setHoverY(e.clientY);
            } else {
                setHoverPrice(null);
            }
        } catch {
            setHoverPrice(null);
        }
    }, [seriesRef, overlayRect, menuOpen]);

    const handleOverlayMouseLeave = useCallback(() => {
        if (!menuOpen) setHoverPrice(null);
    }, [menuOpen]);

    // ── Click on overlay opens menu at cursor price ──
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const series = seriesRef.current;
        if (!series || !overlayRect) return;

        const localY = e.clientY - overlayRect.top;
        try {
            const price = series.coordinateToPrice(localY);
            if (typeof price === 'number' && isFinite(price) && price > 0) {
                setMenuPrice(price);
                setMenuPos({ x: overlayRect.left - 8, y: e.clientY });
                setMenuOpen(true);
            }
        } catch { /* series not ready */ }
    }, [seriesRef, overlayRect]);

    // ── Block right-click default on overlay ──
    const handleOverlayContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Also open menu on right-click
        const series = seriesRef.current;
        if (!series || !overlayRect) return;

        const localY = e.clientY - overlayRect.top;
        try {
            const price = series.coordinateToPrice(localY);
            if (typeof price === 'number' && isFinite(price) && price > 0) {
                setMenuPrice(price);
                setMenuPos({ x: overlayRect.left - 8, y: e.clientY });
                setMenuOpen(true);
            }
        } catch { /* series not ready */ }
    }, [seriesRef, overlayRect]);

    // ── Forward wheel events so chart zoom still works ──
    useEffect(() => {
        const overlay = overlayRef.current;
        const container = containerRef.current;
        if (!overlay || !container) return;

        const onWheel = (e: WheelEvent) => {
            // Re-dispatch the wheel event on the container so chart zooms
            const cloned = new WheelEvent('wheel', {
                deltaX: e.deltaX,
                deltaY: e.deltaY,
                deltaZ: e.deltaZ,
                deltaMode: e.deltaMode,
                clientX: e.clientX,
                clientY: e.clientY,
                screenX: e.screenX,
                screenY: e.screenY,
                bubbles: true,
                cancelable: true,
            });
            container.dispatchEvent(cloned);
        };

        overlay.addEventListener('wheel', onWheel, { passive: true });
        return () => overlay.removeEventListener('wheel', onWheel);
    }, [containerRef]);

    // ── Close menu on outside click or Escape ──
    useEffect(() => {
        if (!menuOpen) return;

        const onClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', onClickOutside);
            document.addEventListener('keydown', onKeyDown);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    // ── Menu action helpers ──
    const doAction = useCallback((action: () => void) => {
        action();
        setMenuOpen(false);
        setHoverPrice(null);
    }, []);

    const sym = instrument.toUpperCase();
    const fmtPrice = formatPrice(menuPrice, priceDecimals);

    // ── Menu items ──
    const menuItems = [
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6" strokeDasharray="2 2" />
                    <path d="M8 5v6M5 8h6" />
                </svg>
            ),
            label: `Add alert on ${sym} at ${fmtPrice}`,
            shortcut: 'Alt + A',
            action: () => doAction(() => onAddAlert(menuPrice)),
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6l4 5 4-5" />
                    <path d="M4 3l4 5 4-5" />
                </svg>
            ),
            label: `Sell ${orderVolume} ${sym} @ ${fmtPrice} limit`,
            shortcut: 'Alt + Shift + S',
            action: () => doAction(() => onSellLimit(menuPrice)),
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 10l4-5 4 5" />
                    <path d="M4 13l4-5 4 5" />
                </svg>
            ),
            label: `Buy ${orderVolume} ${sym} @ ${fmtPrice} stop`,
            shortcut: '',
            action: () => doAction(() => onBuyStop(menuPrice)),
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="12" height="10" rx="1.5" />
                    <path d="M5 7h6M5 9.5h4" />
                </svg>
            ),
            label: `Add order on ${sym} at ${fmtPrice}...`,
            shortcut: 'Shift + T',
            action: () => doAction(() => onAddOrder(menuPrice)),
        },
        {
            icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="4" cy="8" r="2" />
                    <path d="M6 8h8" strokeDasharray="3 2" />
                </svg>
            ),
            label: `Draw horizontal line at ${fmtPrice}`,
            shortcut: 'Alt + H',
            action: () => doAction(() => onDrawHLine(menuPrice)),
        },
    ];

    return (
        <>
            {/* Transparent overlay sitting on top of the price scale.
                This intercepts all mouse events before Lightweight Charts
                can handle them (scaling / native context menu). */}
            {overlayRect && createPortal(
                <div
                    ref={overlayRef}
                    onMouseMove={handleOverlayMouseMove}
                    onMouseLeave={handleOverlayMouseLeave}
                    onClick={handleOverlayClick}
                    onContextMenu={handleOverlayContextMenu}
                    style={{
                        position: 'fixed',
                        left: overlayRect.left,
                        top: overlayRect.top,
                        width: overlayRect.width,
                        height: overlayRect.height,
                        zIndex: 45,
                        cursor: 'pointer',
                        // transparent but still captures events
                        background: 'transparent',
                    }}
                >
                    {/* Floating "+" icon follows cursor */}
                    {hoverPrice !== null && !menuOpen && (
                        <div
                            style={{
                                position: 'fixed',
                                left: overlayRect.left - 12,
                                top: hoverY - 12,
                                pointerEvents: 'none',
                            }}
                        >
                            <div className="w-6 h-6 rounded-full border border-gray-500 bg-[#1e222d]/90 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#9E9EA6" strokeWidth="1.5">
                                    <path d="M6 2v8M2 6h8" />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>,
                document.body,
            )}

            {/* Context menu */}
            {menuOpen && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        left: Math.max(8, menuPos.x - 340),
                        top: Math.max(8, menuPos.y - 10),
                        zIndex: 100,
                    }}
                    className="min-w-[320px] bg-[#1e222d] border border-[#363a45] rounded-lg shadow-2xl py-1 select-none"
                >
                    {menuItems.map((item, i) => (
                        <button
                            key={i}
                            onClick={item.action}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d4dc] hover:bg-[#2a2e39]
                                       transition-colors text-left group"
                        >
                            <span className="text-[#787b86] group-hover:text-[#d1d4dc] shrink-0">
                                {item.icon}
                            </span>
                            <span className="flex-1 font-normal">{item.label}</span>
                            {item.shortcut && (
                                <span className="text-xs text-[#787b86] ml-4 shrink-0">{item.shortcut}</span>
                            )}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}
