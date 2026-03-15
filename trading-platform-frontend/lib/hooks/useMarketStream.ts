'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTradingStore } from '@/lib/stores/tradingStore';
import type {
    Candle,
    Tick,
    IndicatorUpdate,
    ConnectionStatus,
    MARKET_EVENTS as EventKeys,
} from '@/lib/types/trading';

const MARKET_EVENTS = {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    PING: 'ping',
    CANDLE_UPDATE: 'candle:update',
    INDICATOR_UPDATE: 'indicator:update',
    TICK: 'tick',
    POSITION_UPDATE: 'position:update',
    ORDER_EVENT: 'order:event',
    RISK_UPDATE: 'risk:update',
    ACCOUNT_SNAPSHOT: 'account:snapshot',
    STRATEGY_LOG: 'strategy:log',
    PONG: 'pong',
} as const;

interface UseMarketStreamParams {
    symbol: string;
    timeframe: string;
    replayActive: boolean;
}

interface UseMarketStreamReturn {
    lastTick: Tick | null;
    connectionStatus: ConnectionStatus;
    latencyMs: number;
    registerCandleHandler: (fn: (candle: Candle) => void) => void;
    registerIndicatorHandler: (fn: (update: IndicatorUpdate) => void) => void;
}

export function useMarketStream({
    symbol,
    timeframe,
    replayActive,
}: UseMarketStreamParams): UseMarketStreamReturn {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [latencyMs, setLatencyMs] = useState(0);
    const [lastTick, setLastTick] = useState<Tick | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const candleHandlerRef = useRef<((candle: Candle) => void) | null>(null);
    const indicatorHandlerRef = useRef<((update: IndicatorUpdate) => void) | null>(null);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pingSentAtRef = useRef<number>(0);

    const {
        upsertPosition,
        upsertOrder,
        setRiskMetrics,
        updateAccount,
    } = useTradingStore();

    const registerCandleHandler = useCallback((fn: (candle: Candle) => void) => {
        candleHandlerRef.current = fn;
    }, []);

    const registerIndicatorHandler = useCallback((fn: (update: IndicatorUpdate) => void) => {
        indicatorHandlerRef.current = fn;
    }, []);

    useEffect(() => {
        // In replay mode, don't connect to live stream
        if (replayActive) {
            return;
        }

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

        const socket = io(`${wsUrl}/market`, {
            auth: { token },
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            setConnectionStatus('connected');
            socket.emit(MARKET_EVENTS.SUBSCRIBE, { symbol, timeframe });
        });

        socket.on('disconnect', () => {
            setConnectionStatus('disconnected');
        });

        socket.on('connect_error', () => {
            setConnectionStatus('error');
        });

        // Data events
        socket.on(MARKET_EVENTS.CANDLE_UPDATE, (data: { candle?: Candle; candles?: Candle[]; snapshot?: boolean }) => {
            if (data.snapshot && data.candles) {
                // Initial snapshot — handled by chart component via setData
                return;
            }
            if (data.candle && candleHandlerRef.current) {
                candleHandlerRef.current(data.candle);
            }
        });

        socket.on(MARKET_EVENTS.INDICATOR_UPDATE, (data: IndicatorUpdate) => {
            if (indicatorHandlerRef.current) {
                indicatorHandlerRef.current(data);
            }
        });

        socket.on(MARKET_EVENTS.TICK, (data: Tick) => {
            setLastTick(data);
        });

        socket.on(MARKET_EVENTS.POSITION_UPDATE, (data: Parameters<typeof upsertPosition>[0]) => {
            upsertPosition(data);
        });

        socket.on(MARKET_EVENTS.ORDER_EVENT, (data: { order?: Parameters<typeof upsertOrder>[0] }) => {
            if (data.order) {
                upsertOrder(data.order);
            }
        });

        socket.on(MARKET_EVENTS.RISK_UPDATE, (data: Parameters<typeof setRiskMetrics>[0]) => {
            setRiskMetrics(data);
        });

        socket.on(MARKET_EVENTS.ACCOUNT_SNAPSHOT, (data: Parameters<typeof updateAccount>[0]) => {
            updateAccount(data);
        });

        // Latency measurement
        socket.on(MARKET_EVENTS.PONG, (data: { timestamp: number }) => {
            setLatencyMs(Date.now() - data.timestamp);
        });

        pingIntervalRef.current = setInterval(() => {
            pingSentAtRef.current = Date.now();
            socket.emit(MARKET_EVENTS.PING, { timestamp: pingSentAtRef.current });
        }, 5000);

        socket.connect();

        // Cleanup
        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            socket.emit(MARKET_EVENTS.UNSUBSCRIBE, { symbol, timeframe });
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setConnectionStatus('disconnected');
        };
    }, [symbol, timeframe, replayActive, upsertPosition, upsertOrder, setRiskMetrics, updateAccount]);

    return {
        lastTick,
        connectionStatus,
        latencyMs,
        registerCandleHandler,
        registerIndicatorHandler,
    };
}
