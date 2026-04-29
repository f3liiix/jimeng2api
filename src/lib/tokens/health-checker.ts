import { getTokenLiveStatus } from "@/api/controllers/core.ts";
import { isDatabaseConfigured } from "@/lib/db/client.ts";
import logger from "@/lib/logger.ts";
import { alertStore } from "@/lib/alerts/alert-store.ts";
import { formatManagedToken, tokenPool } from "@/lib/tokens/token-pool.ts";

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

export class TokenHealthChecker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (!isDatabaseConfigured()) return;
    const interval = Number(process.env.TOKEN_HEALTH_CHECK_INTERVAL_MS || DEFAULT_INTERVAL_MS);
    if (!Number.isFinite(interval) || interval <= 0) {
      logger.info("Token 健康检查已禁用");
      return;
    }
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.checkAll().catch((error) => logger.error("Token 健康检查失败:", error));
    }, interval);
    this.timer.unref?.();
    queueMicrotask(() => this.checkAll().catch((error) => logger.error("Token 健康检查失败:", error)));
    logger.success(`Token 健康检查已启动，间隔 ${Math.round(interval / 1000)} 秒`);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async checkAll() {
    if (this.running) return;
    this.running = true;
    try {
      const tokens = (await tokenPool.list()).filter((token) => token.status !== "disabled");
      for (const token of tokens) {
        await this.checkOne(token);
      }
    } finally {
      this.running = false;
    }
  }

  private async checkOne(token: Awaited<ReturnType<typeof tokenPool.list>>[number]) {
    const failureThreshold = Math.max(1, Number(process.env.TOKEN_HEALTH_FAILURE_THRESHOLD || 3));
    try {
      const live = await getTokenLiveStatus(formatManagedToken(token));
      if (live) {
        await tokenPool.update(token.id, {
          status: "healthy",
          lastCheckedAt: new Date(),
          lastError: null,
          failureCount: 0,
        });
        await alertStore.resolveTokenAlerts(token.id);
        return;
      }

      const failureCount = token.failureCount + 1;
      await tokenPool.update(token.id, {
        status: failureCount >= failureThreshold ? "unhealthy" : token.status,
        lastCheckedAt: new Date(),
        lastError: "Token 存活检查未通过",
        failureCount,
      });
      if (failureCount >= failureThreshold) {
        await alertStore.openTokenAlert(token.id, `${token.name} 已连续 ${failureCount} 次检查失败，请更新 sessionid`);
      }
    } catch (error: any) {
      const failureCount = token.failureCount + 1;
      await tokenPool.update(token.id, {
        status: failureCount >= failureThreshold ? "unhealthy" : token.status,
        lastCheckedAt: new Date(),
        lastError: error?.message || "Token 健康检查异常",
        failureCount,
      });
      if (failureCount >= failureThreshold) {
        await alertStore.openTokenAlert(
          token.id,
          `${token.name} 已连续 ${failureCount} 次健康检查失败: ${error?.message || "unknown error"}`,
        );
      }
    }
  }
}

export const tokenHealthChecker = new TokenHealthChecker();
