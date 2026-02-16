import { z } from "zod";
import { UserRole } from '@/types/auth.js';

const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH"]);

export const announcementIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    priority: priorityEnum.default("NORMAL"),
    is_active: z.boolean().optional(),
    start_at: z.string().datetime().optional(),
    end_at: z.string().datetime().optional(),
    roles: z.array(z.nativeEnum(UserRole)).min(1),
  }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    priority: priorityEnum.optional(),
    is_active: z.boolean().optional(),
    start_at: z.string().datetime().optional().nullable(),
    end_at: z.string().datetime().optional().nullable(),
    roles: z.array(z.nativeEnum(UserRole)).optional(),
  }),
});
