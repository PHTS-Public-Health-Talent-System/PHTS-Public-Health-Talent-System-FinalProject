import type { PoolConnection } from 'mysql2/promise';
import type {
  SyncCoreStatus,
  SyncOverallStatus,
  SyncPostStatus,
  SyncStageGroup,
  SyncStageKey,
  SyncStageRun,
  SyncStats,
} from '@/modules/sync/services/shared/sync.types.js';

export type SyncPipelineMode = 'FULL' | 'USER';

export type StageActionResult = {
  skipped?: boolean;
  warning?: string | null;
  payload?: Record<string, unknown>;
};

export type SyncPipelineActions = {
  syncEmployeeProfiles: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncSupportStaff: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncUsers: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncSignatures: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncLicensesQuotas: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncLeaves: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncMovements: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  syncSpecialPositionScopes: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  assignRoles: (ctx: PipelineContext) => Promise<StageActionResult | void>;
  refreshAccessReview: (ctx: PipelineContext) => Promise<StageActionResult | void>;
};

export type PipelineContext = {
  mode: SyncPipelineMode;
  batchId: number;
  triggeredBy: number | null;
  citizenId?: string;
  conn: PoolConnection;
  stats: SyncStats;
  actions: SyncPipelineActions;
};

export type PipelineStageDefinition = {
  key: SyncStageKey;
  group: SyncStageGroup;
  run: (ctx: PipelineContext) => Promise<StageActionResult | void>;
};

export type StageExecutionResult = SyncStageRun & {
  warning?: string | null;
  payload?: Record<string, unknown>;
};

export type PipelineExecutionSummary = {
  core_status: SyncCoreStatus;
  post_status: SyncPostStatus;
  overall_status: SyncOverallStatus;
  warnings_count: number;
  stages: StageExecutionResult[];
};
