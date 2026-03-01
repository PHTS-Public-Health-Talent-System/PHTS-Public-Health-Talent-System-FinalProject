import { z } from 'zod';

const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const syncUserSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, 'userId ต้องเป็นตัวเลข'),
  }),
});

export type SyncUserParams = z.infer<typeof syncUserSchema>['params'];

export const syncBatchesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'page ต้องเป็นตัวเลข')
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('20'),
  }),
});

export type SyncBatchesQuery = z.infer<typeof syncBatchesQuerySchema>['query'];

export const dataIssuesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'page ต้องเป็นตัวเลข')
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('20'),
    batch_id: z.string().regex(/^\d+$/, 'batch_id ต้องเป็นตัวเลข').optional(),
    target_table: z.string().trim().min(1).max(64).optional(),
    issue_code: z.string().trim().min(1).max(64).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  }),
});

export type DataIssuesQuery = z.infer<typeof dataIssuesQuerySchema>['query'];

const syncRecordTableEnum = z.enum([
  'users',
  'emp_profiles',
  'emp_support_staff',
  'leave_records',
  'emp_licenses',
  'leave_quotas',
  'emp_movements',
  'sig_images',
]);

export const syncRecordsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'page ต้องเป็นตัวเลข')
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('20'),
    batch_id: z.string().regex(/^\d+$/, 'batch_id ต้องเป็นตัวเลข').optional(),
    target_table: syncRecordTableEnum.optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export type SyncRecordsQuery = z.infer<typeof syncRecordsQuerySchema>['query'];

export const userSyncAuditsQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('100'),
    batch_id: z.string().regex(/^\d+$/, 'batch_id ต้องเป็นตัวเลข').optional(),
    citizen_id: z.string().regex(/^\d{13}$/, 'citizen_id ต้องเป็นเลข 13 หลัก').optional(),
    action: z
      .enum(['CREATE', 'ACTIVATE', 'DEACTIVATE', 'PASSWORD_FILLED', 'DEACTIVATE_MISSING'])
      .optional(),
  }),
});

export type UserSyncAuditsQuery = z.infer<typeof userSyncAuditsQuerySchema>['query'];

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

export const syncScheduleSchema = z.object({
  body: z.object({
    mode: z.enum(['DAILY', 'INTERVAL']),
    hour: z
      .number({ error: 'hour ต้องเป็นตัวเลข' })
      .int('hour ต้องเป็นจำนวนเต็ม')
      .min(0, 'hour ต้องอยู่ระหว่าง 0-23')
      .max(23, 'hour ต้องอยู่ระหว่าง 0-23')
      .optional(),
    minute: z
      .number({ error: 'minute ต้องเป็นตัวเลข' })
      .int('minute ต้องเป็นจำนวนเต็ม')
      .min(0, 'minute ต้องอยู่ระหว่าง 0-59')
      .max(59, 'minute ต้องอยู่ระหว่าง 0-59')
      .optional(),
    interval_minutes: z
      .number({ error: 'interval_minutes ต้องเป็นตัวเลข' })
      .int('interval_minutes ต้องเป็นจำนวนเต็ม')
      .min(1, 'interval_minutes ต้องมากกว่า 0')
      .max(1440, 'interval_minutes ต้องไม่เกิน 1440')
      .optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => isValidTimeZone(value), 'timezone ไม่ถูกต้อง')
      .optional(),
  }),
});

export type SyncScheduleBody = z.infer<typeof syncScheduleSchema>['body'];
