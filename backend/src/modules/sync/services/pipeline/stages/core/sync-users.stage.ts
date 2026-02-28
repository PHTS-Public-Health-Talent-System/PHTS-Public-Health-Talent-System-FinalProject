import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncUsersStage: PipelineStageDefinition = {
  key: 'sync-users',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncUsers(ctx),
};
