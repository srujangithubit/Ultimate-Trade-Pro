'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useSyncSocket(syncGroupId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setSocketConnected,
    handleSocketEvent,
    pushReplicationEvent,
  } = useTradeSyncStore();

  useEffect(() => {
    if (!syncGroupId) return;

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null;

    if (!token) return;

    const socket = io(`${SOCKET_URL}/trade-sync`, {
      auth: { token },
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('sync:subscribe_group', { syncGroupId });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Listen for all sync events — names must match backend TRADE_SYNC_EVENTS values
    const eventTypes = [
      'sync:status_update',
      'sync:slave_status_change',
      'sync:master_equity_update',
      'sync:slave_equity_update',
      'sync:kill_switch_triggered',
      'sync:connection_status',
      'sync:positions_update',
      'sync:update',
    ];

    eventTypes.forEach((eventType) => {
      socket.on(eventType, (data: Record<string, unknown>) => {
        handleSocketEvent({ type: eventType, ...data });
      });
    });

    socket.on('sync:replication_result', (data: Record<string, unknown>) => {
      handleSocketEvent({ type: 'sync:replication_result', ...data });
      // Push individual results as events
      const results = data.results as Array<Record<string, unknown>> | undefined;
      if (results) {
        results.forEach((result: Record<string, unknown>) => {
          pushReplicationEvent({
            id: `${Date.now()}-${String(result.slaveId)}`,
            syncGroupId: syncGroupId,
            masterId: '',
            slaveId: String(result.slaveId),
            eventType: 'OPEN',
            symbol: String(data.symbol),
            masterDirection: String(data.direction),
            masterLot: Number(data.lot),
            masterPrice: 0,
            masterTicket: Number(data.masterTicket),
            slaveDirection: String(result.adjustedDirection ?? data.direction),
            slaveLot: Number(result.adjustedLot ?? data.lot),
            slaveTicket: null,
            executedPrice: null,
            executedLot: null,
            status: result.status === 'REPLICATED' ? 'PENDING' : 'REJECTED',
            latencyMs: Number(result.latencyMs),
            errorMessage: result.reason ? String(result.reason) : null,
            executedAt: null,
            createdAt: new Date().toISOString(),
            slave: { displayName: String(result.slaveName), accountNumber: '' },
          });
        });
      }
    });

    socket.on('sync:trade_executed', (data: Record<string, unknown>) => {
      handleSocketEvent({ type: 'sync:trade_executed', ...data });
    });

    // Deferred connect to avoid "closed before established"
    const connectTimer = setTimeout(() => {
      socket.connect();
    }, 0);

    // Ping/pong keepalive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('sync:ping');
      }
    }, 15000);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(pingInterval);
      socket.emit('sync:unsubscribe_group', { syncGroupId });
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [syncGroupId, setSocketConnected, handleSocketEvent, pushReplicationEvent]);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      socketRef.current?.emit(event, data);
    },
    [],
  );

  return { emit, socket: socketRef };
}
