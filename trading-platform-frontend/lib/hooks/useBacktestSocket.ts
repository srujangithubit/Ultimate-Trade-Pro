'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import {
    BACKTEST_EVENTS,
    BacktestUpdate,
    ReplaySpeed,
    CreateOrderDto
} from '../types/backtesting';

interface UseBacktestSocketOptions {
    sessionId: string;
    onUpdate: (update: BacktestUpdate) => void;
    onCompleted: (data: { sessionId: string; finalBalance: number }) => void;
    onError: (err: string) => void;
    onStateSync: (state: BacktestUpdate) => void;
    onOrderConfirmed?: (data: { sessionId: string; trade: any }) => void;
    onTradeClosed?: (data: { sessionId: string; trade: any }) => void;
}

export function useBacktestSocket({
    sessionId,
    onUpdate,
    onCompleted,
    onError,
    onStateSync,
    onOrderConfirmed,
    onTradeClosed,
}: UseBacktestSocketOptions) {
    const socketRef = useRef<Socket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const { user, token } = useAuthStore();

    const onUpdateRef = useRef(onUpdate);
    const onCompletedRef = useRef(onCompleted);
    const onErrorRef = useRef(onError);
    const onStateSyncRef = useRef(onStateSync);
    const onOrderConfirmedRef = useRef(onOrderConfirmed);
    const onTradeClosedRef = useRef(onTradeClosed);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
        onCompletedRef.current = onCompleted;
        onErrorRef.current = onError;
        onStateSyncRef.current = onStateSync;
        onOrderConfirmedRef.current = onOrderConfirmed;
        onTradeClosedRef.current = onTradeClosed;
    }, [onUpdate, onCompleted, onError, onStateSync, onOrderConfirmed, onTradeClosed]);

    useEffect(() => {
        if (!sessionId || !user) return;

        const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
        if (!authToken) {
            setConnectionStatus('disconnected');
            onErrorRef.current?.('Unauthorized');
            return;
        }

        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace('/api', '');

        // Defer socket creation to survive React Strict Mode double-invoke.
        // Without this, cleanup would call disconnect() while the transport
        // is still CONNECTING → "closed before established" browser warning.
        const timer = setTimeout(() => {
            const socket = io(baseUrl, {
                auth: { token: authToken },
                transports: ['websocket', 'polling'],
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                setConnectionStatus('connected');
                socket.emit(BACKTEST_EVENTS.SUBSCRIBE, { sessionId, userId: user.id });
            });

            socket.on('connect_error', (err) => {
                setConnectionStatus('disconnected');
                onErrorRef.current?.(err.message);
            });

            socket.on('disconnect', () => {
                setConnectionStatus('disconnected');
            });

            socket.on(BACKTEST_EVENTS.UPDATE, (payload: BacktestUpdate) => {
                onUpdateRef.current?.(payload);
            });

            socket.on(BACKTEST_EVENTS.STATE_SYNC, (payload: BacktestUpdate) => {
                onStateSyncRef.current?.(payload);
            });

            socket.on(BACKTEST_EVENTS.COMPLETED, (payload: { sessionId: string; finalBalance: number }) => {
                onCompletedRef.current?.(payload);
            });

            socket.on(BACKTEST_EVENTS.ERROR, (payload: { message: string }) => {
                onErrorRef.current?.(payload.message);
            });

            socket.on('backtest:order_confirmed', (payload: any) => {
                onOrderConfirmedRef.current?.(payload);
            });

            socket.on('backtest:trade_closed', (payload: any) => {
                onTradeClosedRef.current?.(payload);
            });

            socket.connect();
        }, 0);

        return () => {
            clearTimeout(timer);
            if (socketRef.current) {
                socketRef.current.emit('unsubscribe:backtest', { sessionId });
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [sessionId, user, token]);

    const play = useCallback((speed?: ReplaySpeed) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.PLAY, { sessionId, userId: user?.id, speed });
        }
    }, [sessionId, user]);

    const pause = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.PAUSE, { sessionId, userId: user?.id });
        }
    }, [sessionId, user]);

    const seek = useCallback((index: number) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.SEEK, { sessionId, index, userId: user?.id });
        }
    }, [sessionId, user]);

    const setSpeed = useCallback((speed: ReplaySpeed) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.SPEED, { sessionId, speed, userId: user?.id });
        }
    }, [sessionId, user]);

    const createOrder = useCallback((dto: CreateOrderDto) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.ORDER, { sessionId, order: dto, userId: user?.id });
        }
    }, [sessionId, user]);

    const closeTrade = useCallback((tradeId: string, exitPrice?: number) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.CLOSE_TRADE, { sessionId, tradeId, userId: user?.id, exitPrice });
        }
    }, [sessionId, user]);

    const changeTimeframe = useCallback((timeframe: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(BACKTEST_EVENTS.CHANGE_TIMEFRAME, { sessionId, timeframe });
        }
    }, [sessionId]);

    return {
        play,
        pause,
        seek,
        setSpeed,
        createOrder,
        closeTrade,
        changeTimeframe,
        connectionStatus
    };
}
