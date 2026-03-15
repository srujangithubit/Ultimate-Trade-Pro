'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type {
  SyncGroup,
  RegisterMasterPayload,
  RegisterSlavePayload,
  GroupPerformance,
  ReplicationEvent,
  SyncAuditLog,
  ReplicationStats,
} from '@/types/trade-sync';

const KEYS = {
  syncGroups: ['trade-sync', 'groups'] as const,
  syncGroup: (id: string) => ['trade-sync', 'group', id] as const,
  performance: (id: string) => ['trade-sync', 'performance', id] as const,
  replicationHistory: (id: string) =>
    ['trade-sync', 'replication', id] as const,
  auditLogs: (id: string) => ['trade-sync', 'audit', id] as const,
  stats: (id: string) => ['trade-sync', 'stats', id] as const,
};

/* ───── Queries ───── */

export function useSyncGroups() {
  return useQuery<SyncGroup[]>({
    queryKey: KEYS.syncGroups,
    queryFn: async () => {
      const { data } = await api.get('/api/trade-sync/master');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useSyncGroup(syncGroupId: string | null) {
  return useQuery<SyncGroup>({
    queryKey: KEYS.syncGroup(syncGroupId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(
        `/api/trade-sync/master/${syncGroupId}`,
      );
      return data;
    },
    enabled: !!syncGroupId,
    refetchInterval: 10000,
  });
}

export function useGroupPerformance(syncGroupId: string | null) {
  return useQuery<GroupPerformance>({
    queryKey: KEYS.performance(syncGroupId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(
        `/api/trade-sync/performance/${syncGroupId}`,
      );
      return data;
    },
    enabled: !!syncGroupId,
    refetchInterval: 15000,
  });
}

export function useReplicationHistory(
  syncGroupId: string | null,
  limit = 50,
) {
  return useQuery<{ events: ReplicationEvent[]; total: number }>({
    queryKey: [...KEYS.replicationHistory(syncGroupId ?? ''), limit],
    queryFn: async () => {
      const { data } = await api.get(
        `/api/trade-sync/replication/${syncGroupId}`,
        { params: { limit } },
      );
      return data;
    },
    enabled: !!syncGroupId,
    refetchInterval: 10000,
  });
}

export function useAuditLogs(syncGroupId: string | null) {
  return useQuery<{ logs: SyncAuditLog[]; total: number }>({
    queryKey: KEYS.auditLogs(syncGroupId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(
        `/api/trade-sync/audit/${syncGroupId}`,
      );
      return data;
    },
    enabled: !!syncGroupId,
    refetchInterval: 30000,
  });
}

export function useReplicationStats(syncGroupId: string | null) {
  return useQuery<ReplicationStats>({
    queryKey: KEYS.stats(syncGroupId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(
        `/api/trade-sync/performance/${syncGroupId}/stats`,
      );
      return data;
    },
    enabled: !!syncGroupId,
    refetchInterval: 15000,
  });
}

/* ───── Mutations ───── */

export function useRegisterMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RegisterMasterPayload) => {
      const { data } = await api.post(
        '/api/trade-sync/master/register',
        payload,
      );
      return data as SyncGroup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useRegisterSlave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RegisterSlavePayload) => {
      const { data } = await api.post(
        '/api/trade-sync/slave/register',
        payload,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: KEYS.syncGroup(variables.syncGroupId),
      });
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useDeleteSyncGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (syncGroupId: string) => {
      await api.delete(`/api/trade-sync/master/${syncGroupId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function usePauseSlave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slaveId: string) => {
      const { data } = await api.post(
        `/api/trade-sync/slave/${slaveId}/pause`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useResumeSlave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slaveId: string) => {
      const { data } = await api.post(
        `/api/trade-sync/slave/${slaveId}/resume`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useTriggerKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slaveId: string) => {
      const { data } = await api.post(
        `/api/trade-sync/slave/${slaveId}/kill`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useResetKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slaveId: string) => {
      const { data } = await api.post(
        `/api/trade-sync/slave/${slaveId}/reset-kill`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useUpdateRiskConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slaveId,
      config,
    }: {
      slaveId: string;
      config: Record<string, unknown>;
    }) => {
      const { data } = await api.put(
        `/api/trade-sync/slave/${slaveId}/risk-config`,
        config,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}

export function useDeleteSlave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slaveId: string) => {
      await api.delete(`/api/trade-sync/slave/${slaveId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.syncGroups });
    },
  });
}
