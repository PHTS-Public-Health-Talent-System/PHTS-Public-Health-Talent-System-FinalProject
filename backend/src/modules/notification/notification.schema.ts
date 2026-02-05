import { z } from "zod";

// PUT /notifications/:id/read
export const markReadSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  }),
});

export type MarkReadParams = z.infer<typeof markReadSchema>["params"];

// DELETE /notifications/read
export const deleteReadSchema = z.object({
  body: z
    .object({
      older_than_days: z.number().int().positive().optional(),
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
