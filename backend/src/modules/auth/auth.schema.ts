import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    citizen_id: z
      .string()
      .min(1, "Citizen ID is required")
      .max(13, "Citizen ID must be 13 characters"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    first_name: z.string().trim().min(1, "First name is required").max(100),
    last_name: z.string().trim().min(1, "Last name is required").max(100),
    email: z
      .string()
      .trim()
      .email("Invalid email format")
      .max(100)
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(50)
      .regex(/^[0-9+\-()\s]*$/, "Invalid phone number format")
      .or(z.literal("")),
  }),
});

// Infer types
export type LoginSchema = z.infer<typeof loginSchema>["body"];
export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>["body"];
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>["body"];
