import { z } from "zod";

const reportQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2600),
  month: z.coerce.number().int().min(1).max(12),
  format: z.enum(["xlsx", "csv"]).optional(),
  profession: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, "Invalid profession code")
    .optional(),
});

export const downloadDetailReportSchema = z.object({
  query: reportQuery,
});

export const downloadSummaryReportSchema = z.object({
  query: reportQuery.omit({ profession: true }),
});

export type DownloadDetailReportQuery = z.infer<typeof downloadDetailReportSchema>["query"];
export type DownloadSummaryReportQuery = z.infer<typeof downloadSummaryReportSchema>["query"];
