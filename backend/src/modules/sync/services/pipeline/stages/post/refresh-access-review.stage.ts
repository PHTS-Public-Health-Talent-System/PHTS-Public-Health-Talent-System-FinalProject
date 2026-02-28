import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const refreshAccessReviewStage: PipelineStageDefinition = {
  key: 'refresh-access-review',
  group: 'POST',
  run: async (ctx) => ctx.actions.refreshAccessReview(ctx),
};
