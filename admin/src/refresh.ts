export const ACCOUNT_REFRESH_INTERVAL_MS = 60_000;
export const ACTIVE_TASK_REFRESH_INTERVAL_MS = 10_000;
export const IDLE_TASK_REFRESH_INTERVAL_MS = 60_000;

export function getTaskRefreshIntervalMs(tasks: Array<{ status?: string | null }>) {
  return tasks.some((task) => task.status === "queued" || task.status === "running")
    ? ACTIVE_TASK_REFRESH_INTERVAL_MS
    : IDLE_TASK_REFRESH_INTERVAL_MS;
}
