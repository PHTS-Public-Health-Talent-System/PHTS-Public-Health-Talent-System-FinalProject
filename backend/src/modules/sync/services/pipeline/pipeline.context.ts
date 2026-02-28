import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';
import { syncEmployeeProfilesStage } from '@/modules/sync/services/pipeline/stages/core/sync-employee-profiles.stage.js';
import { syncSupportStaffStage } from '@/modules/sync/services/pipeline/stages/core/sync-support-staff.stage.js';
import { syncUsersStage } from '@/modules/sync/services/pipeline/stages/core/sync-users.stage.js';
import { syncSignaturesStage } from '@/modules/sync/services/pipeline/stages/core/sync-signatures.stage.js';
import { syncLicensesQuotasStage } from '@/modules/sync/services/pipeline/stages/core/sync-licenses-quotas.stage.js';
import { syncLeavesStage } from '@/modules/sync/services/pipeline/stages/core/sync-leaves.stage.js';
import { syncMovementsStage } from '@/modules/sync/services/pipeline/stages/core/sync-movements.stage.js';
import { syncSpecialPositionScopesStage } from '@/modules/sync/services/pipeline/stages/post/sync-special-position-scopes.stage.js';
import { assignRolesStage } from '@/modules/sync/services/pipeline/stages/post/assign-roles.stage.js';
import { refreshAccessReviewStage } from '@/modules/sync/services/pipeline/stages/post/refresh-access-review.stage.js';

export const CORE_PIPELINE_STAGES: PipelineStageDefinition[] = [
  syncEmployeeProfilesStage,
  syncSupportStaffStage,
  syncUsersStage,
  syncSignaturesStage,
  syncLicensesQuotasStage,
  syncLeavesStage,
  syncMovementsStage,
];

export const POST_PIPELINE_STAGES: PipelineStageDefinition[] = [
  syncSpecialPositionScopesStage,
  assignRolesStage,
  refreshAccessReviewStage,
];
