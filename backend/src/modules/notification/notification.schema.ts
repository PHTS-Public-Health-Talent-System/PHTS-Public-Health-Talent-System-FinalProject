import { z } from "zod";

// GET /notifications
export const listNotificationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>["query"];

// PUT /notifications/:id/read
export const markReadSchema = z.object({
  params: z.object({
    // Controller supports "all" for marking everything as read.
    id: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .refine((value) => value === "all" || /^\d+$/.test(value), {
        message: "id ต้องเป็นตัวเลข หรือ all",
      }),
  }),
});

export type MarkReadParams = z.infer<typeof markReadSchema>["params"];

// DELETE /notifications/read
export const deleteReadSchema = z.object({
  body: z
    .object({
      older_than_days: z.coerce.number().int().positive().optional(),
    })
    .optional(),
});

export type DeleteReadBody = z.infer<typeof deleteReadSchema>["body"];

// PUT /notifications/settings
export const notificationSettingsSchema = z.object({
  body: z.object({
    in_app: z.boolean(),
    sms: z.boolean(),
    email: z.boolean(),
  }),
});

export type NotificationSettingsBody = z.infer<typeof notificationSettingsSchema>["body"];
