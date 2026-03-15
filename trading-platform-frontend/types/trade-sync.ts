/* ───── Enums ───── */

export type SyncGroupStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type SlaveStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'KILLED' | 'ERROR';
export type ReplicationEventType = 'OPEN' | 'CLOSE' | 'MODIFY';
export type ReplicationStatus = 'PENDING' | 'FILLED' | 'REJECTED' | 'FAILED';
export type RiskMode =
  | 'LOT_MULTIPLIER'
  | 'FIXED_LOT'
  | 'RISK_PERCENTAGE'
  | 'EQUITY_PERCENTAGE';

/* ───── Risk Config ───── */

export interface RiskConfig {
  mode: RiskMode;
  lotMultiplier: number;
  fixedLot?: number | null;
  riskPercentage?: number | null;
  equityPercentage?: number | null;
  maxLotSize: number;
  minLotSize: number;
  reverseDirection: boolean;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  slippage: number;
}

/* ───── Master Account ───── */

export interface MasterAccount {
  id: string;
  syncGroupId: string;
  userId: string;
  accountNumber: string;
  brokerName: string;
  serverName: string;
  displayName: string;
  equity: number;
  balance: number;
  floatingPnL: number;
  isConnected: boolean;
  lastHeartbeat: string | null;
  createdAt: string;
}

/* ───── Slave Account ───── */

export interface SlaveAccount {
  id: string;
  syncGroupId: string;
  userId: string;
  accountNumber: string;
  brokerName: string;
  serverName: string;
  displayName: string;
  status: SlaveStatus;
  riskMode: RiskMode;
  lotMultiplier: number;
  fixedLot: number | null;
  riskPercentage: number | null;
  equityPercentage: number | null;
  maxLotSize: number;
  minLotSize: number;
  reverseDirection: boolean;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  slippagePoints: number;
  symbolFilters: string[];
  equity: number;
  balance: number;
  floatingPnL: number;
  isConnected: boolean;
  lastHeartbeat: string | null;
  killSwitchActive: boolean;
  killSwitchAt: string | null;
  dailyDrawdownPct: number;
  maxDailyDrawdownPct: number;
  startOfDayEquity: number | null;
  createdAt: string;
}

/* ───── Sync Group ───── */

export interface SyncGroup {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: SyncGroupStatus;
  masterAccount: MasterAccount | null;
  slaveAccounts: SlaveAccount[];
  createdAt: string;
  updatedAt: string;
}

/* ───── Replication Event ───── */

export interface ReplicationEvent {
  id: string;
  syncGroupId: string;
  masterId: string;
  slaveId: string;
  eventType: ReplicationEventType;
  symbol: string;
  masterDirection: string;
  masterLot: number;
  masterPrice: number;
  masterTicket: number;
  slaveDirection: string;
  slaveLot: number;
  slaveTicket: number | null;
  executedPrice: number | null;
  executedLot: number | null;
  status: ReplicationStatus;
  latencyMs: number;
  errorMessage: string | null;
  executedAt: string | null;
  createdAt: string;
  slave?: {
    displayName: string;
    accountNumber: string;
  };
}

/* ───── Audit Log ───── */

export interface SyncAuditLog {
  id: string;
  syncGroupId: string;
  action: string;
  message: string;
  createdAt: string;
}

/* ───── Equity Snapshot ───── */

export interface EquitySnapshot {
  equity: number;
  balance: number;
  time: string;
}

/* ───── Live Position ───── */

export interface LivePosition {
  ticket: number;
  symbol: string;
  type: number;
  direction: 'BUY' | 'SELL';
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  profit: number;
  swap: number;
  sl: number;
  tp: number;
  time: number;
  comment: string;
}

export interface AccountPositions {
  accountType: 'master' | 'slave';
  accountId: string;
  login: string;
  positions: LivePosition[];
  totalProfit: number;
  totalSwap: number;
  totalPnL: number;
  positionCount: number;
  timestamp: number;
}

/* ───── Replication Stats ───── */

export interface ReplicationStats {
  totalTrades: number;
  filled: number;
  rejected: number;
  failed: number;
  successRate: number;
  avgLatencyMs: number;
}

/* ───── Performance Response ───── */

export interface GroupPerformance {
  syncGroupId: string;
  groupName: string;
  status: SyncGroupStatus;
  master: {
    id: string;
    displayName: string;
    accountNumber: string;
    equity: number;
    balance: number;
    floatingPnL: number;
    isConnected: boolean;
    lastHeartbeat: string | null;
  } | null;
  slaves: Array<{
    id: string;
    displayName: string;
    accountNumber: string;
    status: SlaveStatus;
    equity: number;
    balance: number;
    floatingPnL: number;
    isConnected: boolean;
    killSwitchActive: boolean;
    dailyDrawdownPct: number;
    maxDailyDrawdownPct: number;
    riskMode: RiskMode;
    lotMultiplier: number;
  }>;
  replicationStats: ReplicationStats;
  masterEquityCurve: EquitySnapshot[];
  slaveEquityCurves: Array<{
    slaveId: string;
    slaveName: string;
    curve: EquitySnapshot[];
  }>;
}

/* ───── Register DTOs ───── */

export interface RegisterMasterPayload {
  groupName: string;
  displayName: string;
  accountNumber: string;
  brokerName: string;
  serverName: string;
  description?: string;
}

export interface RegisterSlavePayload {
  syncGroupId: string;
  displayName: string;
  accountNumber: string;
  brokerName: string;
  serverName: string;
  riskConfig: RiskConfig;
  symbolFilters?: string[];
  maxDailyDrawdownPct?: number;
}

/* ───── Socket Events ───── */

export interface SyncSocketEvent {
  type: string;
  [key: string]: unknown;
}

export interface ReplicationResultEvent {
  masterTicket: number;
  symbol: string;
  direction: string;
  lot: number;
  results: Array<{
    slaveId: string;
    slaveName: string;
    status: 'REPLICATED' | 'REJECTED' | 'FAILED';
    adjustedLot?: number;
    adjustedDirection?: string;
    reason?: string;
    latencyMs: number;
  }>;
}
