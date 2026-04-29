export const ACCOUNT_REFRESH_INTERVAL_MS = 60_000;
export const ACTIVE_TASK_REFRESH_INTERVAL_MS = 10_000;
export const IDLE_TASK_REFRESH_INTERVAL_MS = 60_000;

export const adminRoutes = ["tokens", "api-keys", "tasks", "alerts"] as const;
export type AdminRoute = (typeof adminRoutes)[number];

export const adminRoutePaths: Record<AdminRoute, string> = {
  tokens: "/admin/tokens",
  "api-keys": "/admin/api-keys",
  tasks: "/admin/tasks",
  alerts: "/admin/alerts",
};

export function getAdminRouteFromPathname(pathname: string): AdminRoute {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/admin";
  const match = adminRoutes.find((route) => adminRoutePaths[route] === normalizedPath);
  return match || "tokens";
}

export function getTaskRefreshIntervalMs(tasks: Array<{ status?: string | null }>) {
  return tasks.some((task) => task.status === "queued" || task.status === "running")
    ? ACTIVE_TASK_REFRESH_INTERVAL_MS
    : IDLE_TASK_REFRESH_INTERVAL_MS;
}
