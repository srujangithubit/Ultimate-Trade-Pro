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
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('WS Connected');
            setIsConnected(true);
            setError(null);

            // Subscribe to session
            socket.emit('subscribe:backtest', {
                sessionId,
                userId: user.id
            });
        });

        socket.on('connect_error', (err) => {
            console.error('WS Connection Error:', err);
            setError(err.message);
            setIsConnected(false);
        });

        socket.on('disconnect', () => {
            console.log('WS Disconnected');
            setIsConnected(false);
        });

        // Handle updates
        socket.on('backtest:update', (payload: any) => {
            if (payload.sessionId === sessionId) {
                setData({
                    currentPrice: payload.currentPrice,
                    timestamp: payload.timestamp,
                    balance: payload.balance,
                    pnl: payload.pnl,
                    volume: payload.volume,
                });
            }
        });

        socket.on('backtest:position-opened', (payload: any) => {
            console.log('Position opened:', payload);
            // Optionally refresh data or show toast
        });

        socket.on('backtest:trade-completed', (payload: any) => {
            console.log('Trade completed:', payload);
        });

        return () => {
            socket.emit('unsubscribe:backtest', { sessionId });
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
