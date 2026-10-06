import Link from "next/link";

import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "./actions";
import {
  notificationKindLabel,
  resolveNotificationFilter,
} from "@/lib/notifications/presentation";
import {
  getMyUnreadNotificationCount,
  listMyNotifications,
} from "@/lib/notifications/server";

type NotificationsPageProps = {
  searchParams: Promise<{
    error?: string;
    filter?: string;
    updated?: string;
  }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const filter = resolveNotificationFilter(params.filter);
  const [notifications, unreadCount] = await Promise.all([
    listMyNotifications({ unreadOnly: filter === "unread", limit: 50 }),
    getMyUnreadNotificationCount(),
  ]);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-emerald-950/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
            >
              ← Dashboard
            </Link>
            <p className="eyebrow mt-6">Personal updates</p>
            <h1 className="page-title">Notifications</h1>
            <p className="page-intro">
              Review updates about committee work assigned to you.
            </p>
          </div>

          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="button-secondary">
                Mark all as read
              </button>
            </form>
          ) : null}
        </header>

        {params.error ? (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            The notification could not be updated. Please try again.
          </div>
        ) : null}

        {params.updated ? (
          <div
            className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            role="status"
          >
            All notifications have been marked as read.
          </div>
        ) : null}

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <nav className="flex gap-2" aria-label="Notification filter">
              <FilterLink href="/notifications" active={filter === "all"}>
                All
              </FilterLink>
              <FilterLink
                href="/notifications?filter=unread"
                active={filter === "unread"}
              >
                Unread
              </FilterLink>
            </nav>
            <p className="text-sm text-zinc-500">
              {unreadCount} unread
            </p>
          </div>

          {notifications.length === 0 ? (
            <div className="surface mt-5 p-8 text-center">
              <h2 className="font-semibold text-emerald-950">
                {filter === "unread"
                  ? "You are all caught up"
                  : "No notifications yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-600">
                {filter === "unread"
                  ? "There are no unread notifications to review."
                  : "Updates about your committee work will appear here."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {notifications.map((notification) => {
                const unread = notification.readAt === null;
                return (
                  <article
                    key={notification.id}
                    className={`notification-item ${unread ? "notification-item-unread" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-badge">
                          {notificationKindLabel(notification.kind)}
                        </span>
                        {unread ? (
                          <span className="notification-unread-label">
                            Unread
                          </span>
                        ) : null}
                        <time
                          dateTime={notification.createdAt}
                          className="text-xs text-zinc-500"
                        >
                          {formatNotificationDate(notification.createdAt)}
                        </time>
                      </div>
                      <h2 className="mt-3 font-semibold text-emerald-950">
                        {notification.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">
                        {notification.body}
                      </p>
                    </div>

                    <form action={openNotificationAction}>
                      <input
                        type="hidden"
                        name="notificationId"
                        value={notification.id}
                      />
                      <input
                        type="hidden"
                        name="targetPath"
                        value={notification.targetPath}
                      />
                      <button type="submit" className="button-secondary">
                        Open
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white"
          : "rounded-lg border border-emerald-950/15 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:border-emerald-700/40"
      }
    >
      {children}
    </Link>
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
