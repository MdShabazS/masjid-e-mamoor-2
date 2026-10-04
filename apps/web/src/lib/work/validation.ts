import { z } from "zod";

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      isCalendarDate(value),
    "Invalid date",
  );

export const committeeTaskDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  priority: z.enum(["low", "normal", "high"]),
  dueDate: optionalDate.transform((value) => value || null),
  assigneeIds: z.array(z.uuid()).min(1),
});

export const committeeTaskIdSchema = z.uuid();
export const committeeTaskProgressSchema = z.string().trim().min(1).max(5000);
export const committeeTaskCompletionSchema = z.string().trim().max(5000);
