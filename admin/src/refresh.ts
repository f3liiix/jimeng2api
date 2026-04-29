export const ACCOUNT_REFRESH_INTERVAL_MS = 60_000;
export const ACTIVE_TASK_REFRESH_INTERVAL_MS = 10_000;
export const IDLE_TASK_REFRESH_INTERVAL_MS = 60_000;

export const adminRoutes = ["tokens", "api-keys", "tasks", "alerts", "docs"] as const;
export type AdminRoute = (typeof adminRoutes)[number];

export const adminRoutePaths: Record<AdminRoute, string> = {
  tokens: "/admin/tokens",
  "api-keys": "/admin/api-keys",
  tasks: "/admin/tasks",
  alerts: "/admin/alerts",
  docs: "/admin/docs",
};

export const taskTableColumns = [
  "id",
  "type",
  "api_key_name",
  "token_name",
  "created_at",
  "updated_at",
  "status",
  "error",
];

export const displayTypeLabels: Record<string, string> = {
  alert: "告警",
  image: "图片",
  image_composition: "图片合成",
  image_generation: "图片生成",
  images: "图片",
  token_unhealthy: "账号异常",
  video: "视频",
  video_generation: "视频生成",
  videos: "视频",
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

export function mergeCreatedApiKey<T extends { id?: string | null }>(rows: T[], created?: T | null) {
  if (!created?.id) return rows;
  return [created, ...rows.filter((row) => row.id !== created.id)];
}
