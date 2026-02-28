import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncSupportStaffStage: PipelineStageDefinition = {
  key: 'sync-support-staff',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncSupportStaff(ctx),
};
