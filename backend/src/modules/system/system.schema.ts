import { z } from "zod";
import { UserRole } from '@/types/auth.js';

// GET /system/users?q=searchTerm
export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().optional().default(""),
  }),
});

export type SearchUsersQuery = z.infer<typeof searchUsersSchema>["query"];

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
