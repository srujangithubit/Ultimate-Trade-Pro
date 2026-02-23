'use client';

import { useRef, useEffect, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi } from 'lightweight-charts';
import { useTheme } from 'next-themes';
import { mockCandlestickData } from '@/lib/api/mock-data';

interface TradingViewChartProps {
    symbol?: string;
    currentTime?: string;
    data?: typeof mockCandlestickData;
}

export default function TradingViewChart({ symbol = 'ES', currentTime, data }: TradingViewChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!chartContainerRef.current || !mounted) return;

        const isDark = resolvedTheme === 'dark';

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { color: isDark ? '#1a1b2e' : '#ffffff' },
                textColor: isDark ? '#a0a3bd' : '#6b7280',
                fontSize: 12,
            },
            grid: {
                vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
                horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    labelBackgroundColor: isDark ? '#2d2e45' : '#f3f4f6',
                },
                horzLine: {
                    color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    labelBackgroundColor: isDark ? '#2d2e45' : '#f3f4f6',
                },
            },
            rightPriceScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
            timeScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                timeVisible: true,
            },
        });

        const chartData = data || mockCandlestickData;

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderDownColor: '#ef4444',
            borderUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            wickUpColor: '#22c55e',
        });
        candleSeries.setData(chartData.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        })));

        // Volume bars
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        volumeSeries.setData(
            chartData.map((d) => ({
                time: d.time,
                value: d.volume,
                color: d.close >= d.open
                    ? 'rgba(34, 197, 94, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)',
            }))
        );

        // If currentTime is provided, scroll to that point
        if (currentTime) {
            const timeStr = currentTime.split('T')[0];
            chart.timeScale().scrollToPosition(-10, false);
            // Find nearest data point
            const idx = chartData.findIndex(d => d.time >= timeStr);
            if (idx >= 0) {
                chart.timeScale().scrollToPosition(idx - chartData.length + 20, false);
            }
        } else {
            chart.timeScale().fitContent();
        }

        chartRef.current = chart;

        // Resize handler
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
        };
    }, [resolvedTheme, data, mounted, currentTime]);

    return (
        <div className="relative h-full w-full">
            {/* Symbol label */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <span className="text-sm font-bold text-foreground/80">{symbol}</span>
                <span className="text-xs text-muted-foreground">• 5m</span>
            </div>
            <div ref={chartContainerRef} className="h-full w-full" />
        </div>
    );
}
