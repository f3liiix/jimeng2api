import { getTokenLiveStatus } from "@/api/controllers/core.ts";
import { isDatabaseConfigured } from "@/lib/db/client.ts";
import logger from "@/lib/logger.ts";
import { alertStore } from "@/lib/alerts/alert-store.ts";
import { dingTalkNotifier } from "@/lib/notifications/dingtalk-notifier.ts";
import { formatManagedToken, tokenPool } from "@/lib/tokens/token-pool.ts";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_FAILURE_THRESHOLD = 2;

type ManagedToken = Awaited<ReturnType<typeof tokenPool.list>>[number];

type TokenHealthCheckerDependencies = {
  getTokenLiveStatus: typeof getTokenLiveStatus;
  isDatabaseConfigured: typeof isDatabaseConfigured;
  logger: typeof logger;
  alertStore: Pick<typeof alertStore, "openTokenAlert" | "resolveTokenAlerts">;
  tokenPool: Pick<typeof tokenPool, "list" | "update">;
  notifier: Pick<typeof dingTalkNotifier, "notifyTokenAlert">;
};

export class TokenHealthChecker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly dependencies: TokenHealthCheckerDependencies;

  constructor(dependencies: Partial<TokenHealthCheckerDependencies> = {}) {
    this.dependencies = {
      getTokenLiveStatus,
      isDatabaseConfigured,
      logger,
      alertStore,
      tokenPool,
      notifier: dingTalkNotifier,
      ...dependencies,
    };
  }

  start() {
    const { isDatabaseConfigured, logger } = this.dependencies;
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
      const tokens = (await this.dependencies.tokenPool.list()).filter((token) => token.status !== "disabled");
      for (const token of tokens) {
        await this.checkOne(token);
      }
    } finally {
      this.running = false;
    }
  }

  private async checkOne(token: ManagedToken) {
    const failureThreshold = Math.max(1, Number(process.env.TOKEN_HEALTH_FAILURE_THRESHOLD || DEFAULT_FAILURE_THRESHOLD));
    try {
      const live = await this.dependencies.getTokenLiveStatus(formatManagedToken(token));
      if (live) {
        await this.dependencies.tokenPool.update(token.id, {
          status: "healthy",
          lastCheckedAt: new Date(),
          lastError: null,
          failureCount: 0,
        });
        await this.dependencies.alertStore.resolveTokenAlerts(token.id);
        return;
      }

      const failureCount = token.failureCount + 1;
      await this.dependencies.tokenPool.update(token.id, {
        status: failureCount >= failureThreshold ? "unhealthy" : token.status,
        lastCheckedAt: new Date(),
        lastError: "账号验证未通过",
        failureCount,
      });
      if (failureCount >= failureThreshold) {
        await this.openTokenAlert(token, `${token.name} 已连续 ${failureCount} 次检查失败，请更新 Session ID`, failureCount);
      }
    } catch (error: any) {
      const failureCount = token.failureCount + 1;
      await this.dependencies.tokenPool.update(token.id, {
        status: failureCount >= failureThreshold ? "unhealthy" : token.status,
        lastCheckedAt: new Date(),
        lastError: error?.message || "账号验证异常",
        failureCount,
      });
      if (failureCount >= failureThreshold) {
        await this.openTokenAlert(token, `${token.name} 已连续 ${failureCount} 次验证失败: ${error?.message || "未知错误"}`, failureCount);
      }
    }
  }

  private async openTokenAlert(
    token: ManagedToken,
    message: string,
    failureCount: number,
  ) {
    const alert = await this.dependencies.alertStore.openTokenAlert(token.id, message);
    if (alert.created) {
      await this.dependencies.notifier.notifyTokenAlert({
        alertId: alert.id,
        tokenId: token.id,
        tokenName: token.name,
        message,
        failureCount,
      });
    }
  }
}

export const tokenHealthChecker = new TokenHealthChecker();
