import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Enter a valid phone number with country code.",
  );

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "OTP must contain exactly 6 digits.");

export const phoneOtpRequestSchema = z.object({
  phone: phoneSchema,
});

export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  token: otpSchema,
});

export const memberDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(120, "Display name must be 120 characters or fewer.");

export const memberPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number with country code.")
  .nullable();

export const ownMemberProfileUpdateSchema = z.object({
  displayName: memberDisplayNameSchema,
  phone: memberPhoneSchema,
  operationId: z.string().trim().min(1).max(100),
});

export const adminMemberProfileUpdateSchema = z.object({
  memberProfileId: z.string().uuid(),
  displayName: memberDisplayNameSchema,
  phone: memberPhoneSchema,
  operationId: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const adminMemberStatusChangeSchema = z.object({
  memberProfileId: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
  operationId: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const memberSearchSchema = z.object({
  search: z.string().trim().max(120).default(""),
});
