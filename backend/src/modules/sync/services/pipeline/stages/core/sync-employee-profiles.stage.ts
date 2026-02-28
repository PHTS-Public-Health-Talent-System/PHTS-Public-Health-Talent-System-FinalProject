import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncEmployeeProfilesStage: PipelineStageDefinition = {
  key: 'sync-employee-profiles',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncEmployeeProfiles(ctx),
};
