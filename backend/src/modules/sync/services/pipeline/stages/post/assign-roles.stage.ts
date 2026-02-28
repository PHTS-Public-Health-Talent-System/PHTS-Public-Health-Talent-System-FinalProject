import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const assignRolesStage: PipelineStageDefinition = {
  key: 'assign-roles',
  group: 'POST',
  run: async (ctx) => ctx.actions.assignRoles(ctx),
};
