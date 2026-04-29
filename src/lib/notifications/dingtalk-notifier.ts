import axios from "axios";

import logger from "@/lib/logger.ts";

const DEFAULT_TIMEOUT_MS = 5000;

export type DingTalkAlert = {
  alertId: string;
  tokenId: string;
  tokenName: string;
  message: string;
  failureCount?: number;
};

export type DingTalkAtOptions = {
  atMobiles: string[];
  atUserIds: string[];
  isAtAll: boolean;
};

export type DingTalkPayload = {
  msgtype: "markdown";
  markdown: {
    title: string;
    text: string;
  };
  at: DingTalkAtOptions;
};

type HttpPost = (
  url: string,
  payload: DingTalkPayload,
  options: { timeout: number },
) => Promise<{ data?: { errcode?: number; errmsg?: string } }>;

type NotifierLogger = {
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

type DingTalkNotifierOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  httpPost?: HttpPost;
  logger?: NotifierLogger;
};

function parseList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function readAtOptions(env: NodeJS.ProcessEnv | Record<string, string | undefined>): DingTalkAtOptions {
  return {
    atMobiles: parseList(env.DINGTALK_AT_MOBILES),
    atUserIds: parseList(env.DINGTALK_AT_USER_IDS),
    isAtAll: parseBoolean(env.DINGTALK_AT_ALL),
  };
}

function describeHttpError(error: unknown) {
  if (!error || typeof error !== "object") return error;
  const err = error as {
    message?: string;
    code?: string;
    response?: {
      status?: number;
      data?: {
        errcode?: number;
        errmsg?: string;
      };
    };
  };
  return {
    message: err.message || "unknown error",
    code: err.code,
    status: err.response?.status,
    errcode: err.response?.data?.errcode,
    errmsg: err.response?.data?.errmsg,
  };
}

export function buildDingTalkAlertPayload(alert: DingTalkAlert, at: DingTalkAtOptions): DingTalkPayload {
  const mentions = [
    ...at.atMobiles.map((mobile) => `@${mobile}`),
    ...at.atUserIds.map((userId) => `@${userId}`),
  ].join(" ");
  const failureLine = alert.failureCount ? `\n- 连续失败次数：${alert.failureCount}` : "";
  const mentionLine = mentions ? `\n\n${mentions}` : "";

  return {
    msgtype: "markdown",
    markdown: {
      title: "即梦API服务告警",
      text: [
        "### 即梦API服务告警",
        "",
        `- 账号：${alert.tokenName}`,
        failureLine.trim(),
        "",
        alert.message,
        mentionLine.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    },
    at,
  };
}

export class DingTalkNotifier {
  private readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  private readonly httpPost: HttpPost;
  private readonly logger: NotifierLogger;

  constructor(options: DingTalkNotifierOptions = {}) {
    this.env = options.env || process.env;
    this.httpPost = options.httpPost || ((url, payload, requestOptions) => axios.post(url, payload, requestOptions));
    this.logger = options.logger || logger;
  }

  isEnabled() {
    return Boolean(this.env.DINGTALK_WEBHOOK_URL?.trim());
  }

  async notifyTokenAlert(alert: DingTalkAlert): Promise<boolean> {
    const webhookUrl = this.env.DINGTALK_WEBHOOK_URL?.trim();
    if (!webhookUrl) return false;

    try {
      const payload = buildDingTalkAlertPayload(alert, readAtOptions(this.env));
      const response = await this.httpPost(webhookUrl, payload, { timeout: DEFAULT_TIMEOUT_MS });
      const data = response.data || {};
      if (data.errcode && data.errcode !== 0) {
        this.logger.warn?.("钉钉机器人告警发送失败:", data.errcode, data.errmsg || "unknown error");
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error?.("钉钉机器人告警发送异常:", describeHttpError(error));
      return false;
    }
  }
}

export const dingTalkNotifier = new DingTalkNotifier();
