import { z } from "zod";
import { UserRole } from '@/types/auth.js';

// GET /system/users?q=searchTerm
export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().optional().default(""),
    page: z
      .string()
      .regex(/^\d+$/, "page ต้องเป็นตัวเลข")
      .optional()
      .default("1"),
    limit: z
      .string()
      .regex(/^\d+$/, "limit ต้องเป็นตัวเลข")
      .optional()
      .default("20"),
    role: z.nativeEnum(UserRole).optional(),
    is_active: z.enum(["0", "1"]).optional(),
  }),
});

export type SearchUsersQuery = z.infer<typeof searchUsersSchema>["query"];

// GET /system/users/:userId
export const getUserByIdSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "userId ต้องเป็นตัวเลข"),
  }),
});

export type GetUserByIdParams = z.infer<typeof getUserByIdSchema>["params"];

// PUT /system/users/:userId/role
export const updateUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "userId ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    role: z.nativeEnum(UserRole, { error: "role ต้องเป็นค่าที่ถูกต้อง" }),
    is_active: z.boolean().optional(),
  }),
});

export type UpdateUserRoleParams = z.infer<
  typeof updateUserRoleSchema
>["params"];
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleSchema>["body"];

// POST /system/maintenance
export const toggleMaintenanceModeSchema = z.object({
  body: z.object({
    enabled: z.boolean({ error: "enabled จำเป็นต้องระบุ" }),
  }),
});

export type ToggleMaintenanceModeBody = z.infer<
  typeof toggleMaintenanceModeSchema
>["body"];

// POST /system/users/:userId/sync
export const syncUserSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "userId ต้องเป็นตัวเลข"),
  }),
});

export type SyncUserParams = z.infer<typeof syncUserSchema>["params"];

// GET /system/backup/history?limit=20
export const backupHistorySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, "limit ต้องเป็นตัวเลข")
      .optional()
      .default("20"),
  }),
});

export type BackupHistoryQuery = z.infer<typeof backupHistorySchema>["query"];

// PUT /system/backup/schedule
export const updateBackupScheduleSchema = z.object({
  body: z.object({
    hour: z
      .number({ error: "hour ต้องเป็นตัวเลข" })
      .int("hour ต้องเป็นจำนวนเต็ม")
      .min(0, "hour ต้องอยู่ระหว่าง 0-23")
      .max(23, "hour ต้องอยู่ระหว่าง 0-23"),
    minute: z
      .number({ error: "minute ต้องเป็นตัวเลข" })
      .int("minute ต้องเป็นจำนวนเต็ม")
      .min(0, "minute ต้องอยู่ระหว่าง 0-59")
      .max(59, "minute ต้องอยู่ระหว่าง 0-59"),
  }),
});

export type UpdateBackupScheduleBody = z.infer<
  typeof updateBackupScheduleSchema
>["body"];
