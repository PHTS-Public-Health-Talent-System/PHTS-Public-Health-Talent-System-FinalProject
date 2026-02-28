import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncLicensesQuotasStage: PipelineStageDefinition = {
  key: 'sync-licenses-quotas',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncLicensesQuotas(ctx),
};
