'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores/authStore';

interface WebSocketData {
    currentPrice: number;
    timestamp: string;
    balance: number;
    pnl: number;
    volume: number;
}

interface UseWebSocketReturn {
    data: WebSocketData | null;
    isConnected: boolean;
    error: string | null;
    send: (event: string, payload: unknown) => void;
}

export function useWebSocket(sessionId: string): UseWebSocketReturn {
    const [data, setData] = useState<WebSocketData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const { user } = useAuthStore();

    useEffect(() => {
        if (!sessionId || !user) return;

        // Determine WebSocket URL (remove /api if present)
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace('/api', '');

        const socket = io(baseUrl, {
            withCredentials: true,
            transports: ['websocket'],
            autoConnect: false,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            setError(null);

            // Subscribe to session
            socket.emit('subscribe:backtest', {
                sessionId,
                userId: user.id
            });
        });

        socket.on('connect_error', (err) => {
            setError(err.message);
            setIsConnected(false);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        // Handle updates
        socket.on('backtest:update', (payload: Record<string, unknown>) => {
            if (payload.sessionId === sessionId) {
                setData({
                    currentPrice: payload.currentPrice as number,
                    timestamp: payload.timestamp as string,
                    balance: payload.balance as number,
                    pnl: payload.pnl as number,
                    volume: payload.volume as number,
                });
            }
        });

        socket.on('backtest:position-opened', () => {
            // Position opened — UI can refresh if needed
        });

        socket.on('backtest:trade-completed', () => {
            // Trade completed — UI can refresh if needed
        });

        socket.connect();

        return () => {
            socket.emit('unsubscribe:backtest', { sessionId });
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [sessionId, user]);

    const send = useCallback((event: string, payload: unknown) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, payload);
        }
    }, []);

    return { data, isConnected, error, send };
}
