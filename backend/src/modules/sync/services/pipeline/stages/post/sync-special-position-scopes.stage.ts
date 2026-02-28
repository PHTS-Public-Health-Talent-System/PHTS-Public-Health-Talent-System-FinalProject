import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncSpecialPositionScopesStage: PipelineStageDefinition = {
  key: 'sync-special-position-scopes',
  group: 'POST',
  run: async (ctx) => ctx.actions.syncSpecialPositionScopes(ctx),
};
