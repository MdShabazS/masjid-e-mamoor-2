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

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(40, "Username must be 40 characters or fewer.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Use only letters, numbers, dot, underscore, or hyphen.",
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.");

export const accountRoleSchema = z.enum([
  "president",
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
]);

export const accountStatusSchema = z.enum([
  "active",
  "deactivated",
]);

export const usernamePasswordLoginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const ownPasswordChangeSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine(
    (value) => value.password === value.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords must match.",
    },
  );

export const accountCreateSchema = z.object({
  username: usernameSchema,
  role: accountRoleSchema,
  displayName: memberDisplayNameSchema,
  password: passwordSchema.optional(),
});

export const accountUsernameChangeSchema = z.object({
  accountId: z.string().uuid(),
  username: usernameSchema,
});

export const ownUsernameChangeSchema = z.object({
  username: usernameSchema,
  currentPassword: z.string().min(1),
});

export const accountPasswordResetSchema = z.object({
  accountId: z.string().uuid(),
  password: passwordSchema.optional(),
});

export const accountRoleChangeSchema = z.object({
  accountId: z.string().uuid(),
  role: accountRoleSchema,
});

export const accountStatusChangeSchema = z.object({
  accountId: z.string().uuid(),
  status: accountStatusSchema,
});

export const financeOperationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

export const financeAccountTypeSchema = z.enum([
  "bank",
  "upi",
  "cash",
  "other",
]);

export const financeAccountStatusSchema = z.enum([
  "active",
  "inactive",
  "closed",
]);

export const financeAccountCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name is required.")
    .max(120, "Account name must be 120 characters or fewer."),
  accountType: financeAccountTypeSchema,
  operationId: financeOperationIdSchema,
});

export const financeAccountStatusChangeSchema = z.object({
  financeAccountId: z.string().uuid(),
  status: financeAccountStatusSchema,
  operationId: financeOperationIdSchema,
});

export const financeAccountRenameSchema = z.object({
  financeAccountId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Account name is required.")
    .max(120, "Account name must be 120 characters or fewer."),
  operationId: financeOperationIdSchema,
});

export const referralCodeSchema = z
  .string()
  .trim()
  .min(16, "Referral code is invalid.")
  .max(128, "Referral code is invalid.");

export const referralOnboardingSubmitSchema = z.object({
  referralCode: referralCodeSchema,
  displayName: memberDisplayNameSchema,
  phone: phoneSchema,
  operationId: z.string().trim().min(1).max(200),
});

export const referralDecisionSchema = z.object({
  referralId: z.string().uuid(),
  operationId: z.string().trim().min(1).max(200),
});

export const referralRejectSchema = referralDecisionSchema.extend({
  reason: z.string().trim().max(500).nullable().optional(),
});

export const referralProvisionSchema = z.object({
  referralId: z.string().uuid(),
  username: usernameSchema,
  password: passwordSchema.optional(),
  operationId: z.string().trim().min(1).max(200),
});

export const donationOperationIdSchema = z.string().trim().min(1).max(200);

export const donationPositiveAmountPaiseSchema = z
  .number()
  .int()
  .positive();

export const donationPaymentAmountPaiseSchema =
  donationPositiveAmountPaiseSchema.min(100);

export const donationPaymentMethodSchema = z.enum([
  "cash",
  "upi",
  "bank_transfer",
  "other",
]);

export const donationPaymentSubmitSchema = z.object({
  amountPaise: donationPaymentAmountPaiseSchema,
  paymentMethod: donationPaymentMethodSchema,
  operationId: donationOperationIdSchema,
});

export const donationPaymentReviewSchema = z.object({
  paymentId: z.string().uuid(),
  operationId: donationOperationIdSchema,
});

export const donationPaymentRejectSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(1),
  operationId: donationOperationIdSchema,
});

export const financeBusinessDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Enter a business date in YYYY-MM-DD format.",
  )
  .refine((value) => {
    const [year, month, day] = value
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(year, month - 1, day),
    );

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Enter a valid business date.");

export const donationPaymentVerifySchema = z.object({
  paymentId: z.string().uuid(),
  financeAccountId: z.string().uuid(),
  businessDate: financeBusinessDateSchema,
  operationId: donationOperationIdSchema,
});

export const donationObligationWaiverSchema = z.object({
  obligationId: z.string().uuid(),
  waivedAmountPaise: donationPositiveAmountPaiseSchema,
  reason: z.string().trim().min(1),
  operationId: donationOperationIdSchema,
});

export const additionalDonationCreateSchema = z.object({
  amountPaise: donationPositiveAmountPaiseSchema,
  operationId: donationOperationIdSchema,
});

export const anonymousDonationCreateSchema = z.object({
  amountPaise: donationPositiveAmountPaiseSchema,
  operationId: donationOperationIdSchema,
});

export const jummahCashDonationCreateSchema = z.object({
  amountPaise: donationPositiveAmountPaiseSchema,
  operationId: donationOperationIdSchema,
});

export const donationMonthInputSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((value) => `${value}-01`);

export const donationObligationRuleCreateSchema = z.object({
  effectiveFromMonth: donationMonthInputSchema,
  monthlyAmountPaise: donationPositiveAmountPaiseSchema,
  operationId: donationOperationIdSchema,
});

export const donationObligationGenerationSchema = z.object({
  effectiveMonth: donationMonthInputSchema,
  operationId: donationOperationIdSchema,
});
