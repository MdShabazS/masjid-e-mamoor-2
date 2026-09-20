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
