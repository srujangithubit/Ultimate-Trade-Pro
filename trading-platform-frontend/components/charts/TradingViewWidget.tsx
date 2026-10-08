'use client';

import { useEffect, useRef, memo } from 'react';
import { useTheme } from 'next-themes';

// Map our internal symbols to TradingView format
const TV_SYMBOL_MAP: Record<string, string> = {
    EURUSD: 'FX:EURUSD',
    GBPUSD: 'FX:GBPUSD',
    USDJPY: 'FX:USDJPY',
    XAUUSD: 'OANDA:XAUUSD',
    BTCUSD: 'COINBASE:BTCUSD',
    US500: 'FOREXCOM:SPXUSD',
    NAS100: 'FOREXCOM:NSXUSD',
    EURGBP: 'FX:EURGBP',
};

// Map our timeframes to TradingView intervals
const TV_INTERVAL_MAP: Record<string, string> = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
};

interface TradingViewWidgetProps {
    symbol: string;
    timeframe: string;
    chartId?: string;
}

function TradingViewWidgetInner({ symbol, timeframe, chartId = 'main' }: TradingViewWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();

    const tvSymbol = TV_SYMBOL_MAP[symbol] || `FX:${symbol}`;
    const tvInterval = TV_INTERVAL_MAP[timeframe] || '5';
    const tvTheme = resolvedTheme === 'light' ? 'light' : 'dark';

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Clear previous widget
        container.innerHTML = '';

        // Create widget container structure
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = '100%';
        widgetDiv.style.width = '100%';
        container.appendChild(widgetDiv);

        // Inject the TradingView Advanced Chart widget script
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: tvSymbol,
            interval: tvInterval,
            timezone: 'Asia/Kolkata',
            theme: tvTheme,
            style: '1',           // Candlesticks
            locale: 'en',
            allow_symbol_change: true,
            calendar: false,
            support_host: 'https://www.tradingview.com',
            hide_top_toolbar: false,
            hide_legend: false,
            hide_side_toolbar: false,
            withdateranges: true,
            save_image: true,
            details: true,
            hotlist: false,
            hide_volume: false,
            show_popup_button: true,
            popup_height: '650',
            popup_width: '1000',
            backgroundColor: tvTheme === 'dark' ? '#0F0F0F' : '#FFFFFF',
            gridColor: tvTheme === 'dark' ? 'rgba(242, 242, 242, 0.2)' : 'rgba(0, 0, 0, 0.08)',
            studies: ['STD;Volume'],
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, [tvSymbol, tvInterval, tvTheme, chartId]);

    return (
        <div
            ref={containerRef}
            className="tradingview-widget-container h-full w-full"
        />
    );
}

const TradingViewWidget = memo(TradingViewWidgetInner);
export default TradingViewWidget;
