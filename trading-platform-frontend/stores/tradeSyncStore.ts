import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  SyncGroup,
  SlaveAccount,
  ReplicationEvent,
  SyncSocketEvent,
  SyncGroupStatus,
  SlaveStatus,
  AccountPositions,
} from '@/types/trade-sync';

interface TradeSyncState {
  /* ─── data ─── */
  syncGroups: SyncGroup[];
  activeGroupId: string | null;
  recentEvents: ReplicationEvent[];
  socketConnected: boolean;
  liveEquity: Record<string, { equity: number; balance: number; floatingPnL: number }>;
  livePositions: Record<string, AccountPositions>;

  /* ─── UI state ─── */
  view: 'overview' | 'setup' | 'dashboard';
  setupStep: number;
  addSlaveOpen: boolean;

  /* ─── actions ─── */
  setSyncGroups: (groups: SyncGroup[]) => void;
  addSyncGroup: (group: SyncGroup) => void;
  removeSyncGroup: (id: string) => void;
  setActiveGroupId: (id: string | null) => void;
  updateGroupStatus: (id: string, status: SyncGroupStatus) => void;

  updateSlaveStatus: (slaveId: string, status: SlaveAccount['status']) => void;
  addSlaveToGroup: (groupId: string, slave: SlaveAccount) => void;
  removeSlaveFromGroup: (groupId: string, slaveId: string) => void;
  updateSlaveKillSwitch: (slaveId: string, active: boolean) => void;

  pushReplicationEvent: (event: ReplicationEvent) => void;
  setRecentEvents: (events: ReplicationEvent[]) => void;

  setSocketConnected: (connected: boolean) => void;
  updateLiveEquity: (accountId: string, data: { equity: number; balance: number; floatingPnL: number }) => void;
  updateLivePositions: (accountId: string, data: AccountPositions) => void;
  handleSocketEvent: (event: SyncSocketEvent) => void;

  setView: (view: TradeSyncState['view']) => void;
  setSetupStep: (step: number) => void;
  setAddSlaveOpen: (open: boolean) => void;

  reset: () => void;
}

const initialState = {
  syncGroups: [] as SyncGroup[],
  activeGroupId: null as string | null,
  recentEvents: [] as ReplicationEvent[],
  socketConnected: false,
  liveEquity: {} as Record<string, { equity: number; balance: number; floatingPnL: number }>,
  livePositions: {} as Record<string, AccountPositions>,
  view: 'overview' as const,
  setupStep: 0,
  addSlaveOpen: false,
};

export const useTradeSyncStore = create<TradeSyncState>()(
  immer((set) => ({
    ...initialState,

    setSyncGroups: (groups) =>
      set((state) => {
        state.syncGroups = groups;
      }),

    addSyncGroup: (group) =>
      set((state) => {
        state.syncGroups.unshift(group);
      }),

    removeSyncGroup: (id) =>
      set((state) => {
        state.syncGroups = state.syncGroups.filter((g) => g.id !== id);
        if (state.activeGroupId === id) state.activeGroupId = null;
      }),

    setActiveGroupId: (id) =>
      set((state) => {
        state.activeGroupId = id;
      }),

    updateGroupStatus: (id, status) =>
      set((state) => {
        const g = state.syncGroups.find((g) => g.id === id);
        if (g) g.status = status;
      }),

    updateSlaveStatus: (slaveId, status) =>
      set((state) => {
        for (const group of state.syncGroups) {
          const slave = group.slaveAccounts.find((s) => s.id === slaveId);
          if (slave) {
            slave.status = status;
            break;
          }
        }
      }),

    addSlaveToGroup: (groupId, slave) =>
      set((state) => {
        const g = state.syncGroups.find((g) => g.id === groupId);
        if (g) g.slaveAccounts.push(slave);
      }),

    removeSlaveFromGroup: (groupId, slaveId) =>
      set((state) => {
        const g = state.syncGroups.find((g) => g.id === groupId);
        if (g) {
          g.slaveAccounts = g.slaveAccounts.filter((s) => s.id !== slaveId);
        }
      }),

    updateSlaveKillSwitch: (slaveId, active) =>
      set((state) => {
        for (const group of state.syncGroups) {
          const slave = group.slaveAccounts.find((s) => s.id === slaveId);
          if (slave) {
            slave.killSwitchActive = active;
            if (active) slave.status = 'KILLED';
            break;
          }
        }
      }),

    pushReplicationEvent: (event) =>
      set((state) => {
        state.recentEvents.unshift(event);
        if (state.recentEvents.length > 100) {
          state.recentEvents = state.recentEvents.slice(0, 100);
        }
      }),

    setRecentEvents: (events) =>
      set((state) => {
        state.recentEvents = events;
      }),

    setSocketConnected: (connected) =>
      set((state) => {
        state.socketConnected = connected;
      }),

    updateLiveEquity: (accountId, data) =>
      set((state) => {
        state.liveEquity[accountId] = data;
      }),

    updateLivePositions: (accountId, data) =>
      set((state) => {
        state.livePositions[accountId] = data;
      }),

    handleSocketEvent: (event) =>
      set((state) => {
        switch (event.type) {
          case 'sync:status_update':
            {
              const g = state.syncGroups.find(
                (g) => g.id === event.syncGroupId,
              );
              if (g) g.status = event.status as SyncGroupStatus;
            }
            break;

          case 'sync:slave_status_change':
            for (const group of state.syncGroups) {
              const slave = group.slaveAccounts.find(
                (s) => s.id === event.slaveId,
              );
              if (slave) {
                slave.status = event.status as SlaveStatus;
                break;
              }
            }
            break;

          case 'sync:master_equity_update':
            state.liveEquity[event.masterId as string] = {
              equity: event.equity as number,
              balance: event.balance as number,
              floatingPnL: event.floatingPnL as number,
            };
            break;

          case 'sync:slave_equity_update':
            state.liveEquity[event.slaveId as string] = {
              equity: event.equity as number,
              balance: event.balance as number,
              floatingPnL: event.floatingPnL as number,
            };
            break;

          case 'sync:positions_update':
            state.livePositions[event.accountId as string] = {
              accountType: event.accountType as 'master' | 'slave',
              accountId: event.accountId as string,
              login: event.login as string,
              positions: event.positions as AccountPositions['positions'],
              totalProfit: event.totalProfit as number,
              totalSwap: event.totalSwap as number,
              totalPnL: event.totalPnL as number,
              positionCount: event.positionCount as number,
              timestamp: event.timestamp as number,
            };
            break;

          case 'sync:kill_switch_triggered':
            for (const group of state.syncGroups) {
              const slave = group.slaveAccounts.find(
                (s) => s.id === event.slaveId,
              );
              if (slave) {
                slave.killSwitchActive = event.active as boolean;
                if (event.active) slave.status = 'KILLED';
                break;
              }
            }
            break;
        }
      }),

    setView: (view) =>
      set((state) => {
        state.view = view;
      }),

    setSetupStep: (step) =>
      set((state) => {
        state.setupStep = step;
      }),

    setAddSlaveOpen: (open) =>
      set((state) => {
        state.addSlaveOpen = open;
      }),

    reset: () => set(() => ({ ...initialState })),
  })),
);
