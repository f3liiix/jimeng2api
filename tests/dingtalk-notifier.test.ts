import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDingTalkAlertPayload,
  DingTalkNotifier,
} from "../src/lib/notifications/dingtalk-notifier.ts";

const alert = {
  alertId: "alert-1",
  tokenId: "token-1",
  tokenName: "即梦账号 1",
  message: "即梦账号 1 已连续 2 次检查失败，请更新 Session ID",
  failureCount: 2,
};

test("buildDingTalkAlertPayload creates markdown alert with optional mentions", () => {
  const payload = buildDingTalkAlertPayload(alert, {
    atMobiles: ["13800138000"],
    atUserIds: ["manager-1"],
    isAtAll: false,
  });

  assert.equal(payload.msgtype, "markdown");
  assert.equal(payload.markdown.title, "即梦API服务告警");
  assert.match(payload.markdown.text, /^### 即梦API服务告警/);
  assert.match(payload.markdown.text, /即梦账号 1/);
  assert.match(payload.markdown.text, /连续失败次数：2/);
  assert.doesNotMatch(payload.markdown.text, /Token ID/);
  assert.doesNotMatch(payload.markdown.text, /Alert ID/);
  assert.doesNotMatch(payload.markdown.text, /token-1/);
  assert.doesNotMatch(payload.markdown.text, /alert-1/);
  assert.match(payload.markdown.text, /@13800138000/);
  assert.deepEqual(payload.at, {
    atMobiles: ["13800138000"],
    atUserIds: ["manager-1"],
    isAtAll: false,
  });
});

test("DingTalkNotifier is a no-op when webhook URL is not configured", async () => {
  let called = false;
  const notifier = new DingTalkNotifier({
    env: {},
    httpPost: async () => {
      called = true;
      return { data: { errcode: 0, errmsg: "ok" } };
    },
  });

  assert.equal(await notifier.notifyTokenAlert(alert), false);
  assert.equal(called, false);
});

test("DingTalkNotifier posts alert payload to configured webhook", async () => {
  let request: any;
  const notifier = new DingTalkNotifier({
    env: {
      DINGTALK_WEBHOOK_URL: "https://oapi.dingtalk.com/robot/send?access_token=test",
      DINGTALK_AT_MOBILES: "13800138000,13900139000",
    },
    httpPost: async (url, payload, options) => {
      request = { url, payload, options };
      return { data: { errcode: 0, errmsg: "ok" } };
    },
  });

  assert.equal(await notifier.notifyTokenAlert(alert), true);
  assert.equal(request.url, "https://oapi.dingtalk.com/robot/send?access_token=test");
  assert.equal(request.options.timeout, 5000);
  assert.deepEqual(request.payload.at.atMobiles, ["13800138000", "13900139000"]);
});

test("DingTalkNotifier handles non-zero DingTalk errcode without throwing", async () => {
  const errors: unknown[] = [];
  const notifier = new DingTalkNotifier({
    env: {
      DINGTALK_WEBHOOK_URL: "https://oapi.dingtalk.com/robot/send?access_token=test",
    },
    httpPost: async () => ({ data: { errcode: 310000, errmsg: "keywords not in content" } }),
    logger: {
      error: (...args: unknown[]) => errors.push(args),
      warn: (...args: unknown[]) => errors.push(args),
    },
  });

  assert.equal(await notifier.notifyTokenAlert(alert), false);
  assert.equal(errors.length, 1);
});

test("DingTalkNotifier does not log webhook URLs from thrown HTTP errors", async () => {
  const errors: unknown[] = [];
  const notifier = new DingTalkNotifier({
    env: {
      DINGTALK_WEBHOOK_URL: "https://oapi.dingtalk.com/robot/send?access_token=secret-token",
    },
    httpPost: async () => {
      throw {
        message: "request failed",
        code: "ECONNRESET",
        config: {
          url: "https://oapi.dingtalk.com/robot/send?access_token=secret-token",
        },
      };
    },
    logger: {
      error: (...args: unknown[]) => errors.push(args),
    },
  });

  assert.equal(await notifier.notifyTokenAlert(alert), false);
  assert.doesNotMatch(JSON.stringify(errors), /secret-token/);
});
