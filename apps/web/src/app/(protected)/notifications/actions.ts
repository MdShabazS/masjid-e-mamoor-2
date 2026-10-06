"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNotificationTarget } from "@/lib/notifications/presentation";
import {
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "@/lib/notifications/server";

const notificationIdSchema = z.uuid();

function refreshNotificationPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function openNotificationAction(formData: FormData) {
  const notificationId = notificationIdSchema.safeParse(
    String(formData.get("notificationId") ?? ""),
  );
  const targetPath = safeNotificationTarget(
    String(formData.get("targetPath") ?? ""),
  );

  if (!notificationId.success) {
    redirect("/notifications?error=invalid_notification");
  }

  try {
    await markMyNotificationRead(notificationId.data);
  } catch {
    redirect("/notifications?error=notification_not_found");
  }

  refreshNotificationPaths();
  redirect(targetPath);
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllMyNotificationsRead();
  } catch {
    redirect("/notifications?error=mark_all_failed");
  }

  refreshNotificationPaths();
  redirect("/notifications?updated=1");
}
