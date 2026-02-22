import { z } from 'zod';

export const syncUserSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, 'userId ต้องเป็นตัวเลข'),
  }),
});

export type SyncUserParams = z.infer<typeof syncUserSchema>['params'];

export const syncBatchesQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('20'),
  }),
});

export type SyncBatchesQuery = z.infer<typeof syncBatchesQuerySchema>['query'];

export const transformLogsQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('50'),
    batch_id: z.string().regex(/^\d+$/, 'batch_id ต้องเป็นตัวเลข').optional(),
  }),
});

export type TransformLogsQuery = z.infer<typeof transformLogsQuerySchema>['query'];

export const dataIssuesQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('50'),
    status: z.enum(['OPEN', 'RESOLVED', 'IGNORED']).optional(),
  }),
});

export type DataIssuesQuery = z.infer<typeof dataIssuesQuerySchema>['query'];

export const createTransformRuleSchema = z.object({
  body: z.object({
    target_view: z.string().trim().min(1).max(64),
    target_field: z.string().trim().min(1).max(64),
    rule_type: z.enum(['REGEX_REPLACE', 'MAP_VALUE', 'DATE_NORMALIZE', 'CLASSIFY_LEAVE_TYPE']),
    match_pattern: z.string().trim().max(500).nullable().optional(),
    replace_value: z.string().trim().max(500).nullable().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
    is_active: z.boolean().optional(),
    notes: z.string().trim().max(255).nullable().optional(),
  }),
});

export type CreateTransformRuleBody = z.infer<typeof createTransformRuleSchema>['body'];

export const refreshAccessReviewSchema = z.object({
  body: z.object({
    citizen_id: z
      .string()
      .trim()
      .regex(/^\d{13}$/, 'citizen_id ต้องเป็นเลข 13 หลัก')
      .optional(),
  }).optional(),
});

export type RefreshAccessReviewBody = z.infer<typeof refreshAccessReviewSchema>['body'];

export const updateTransformRuleSchema = z.object({
  params: z.object({
    ruleId: z.string().regex(/^\d+$/, 'ruleId ต้องเป็นตัวเลข'),
  }),
  body: z.object({
    match_pattern: z.string().trim().max(500).nullable().optional(),
    replace_value: z.string().trim().max(500).nullable().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
    is_active: z.boolean().optional(),
    notes: z.string().trim().max(255).nullable().optional(),
  }),
});

export type UpdateTransformRuleParams = z.infer<typeof updateTransformRuleSchema>['params'];
export type UpdateTransformRuleBody = z.infer<typeof updateTransformRuleSchema>['body'];
