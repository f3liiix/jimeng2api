import assert from "node:assert/strict";
import test from "node:test";

import { TokenHealthChecker } from "../src/lib/tokens/health-checker.ts";

const token = {
  id: "token-1",
  name: "即梦账号 1",
  token: "sessionid",
  region: "cn",
  proxyUrl: null,
  status: "healthy",
  sortOrder: 0,
  lastCheckedAt: null,
  lastError: null,
  failureCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createChecker(alertCreated: boolean, notifyCalls: unknown[]) {
  return new TokenHealthChecker({
    getTokenLiveStatus: async () => false,
    tokenPool: {
      list: async () => [token],
      update: async () => token,
    },
    alertStore: {
      openTokenAlert: async () => ({ id: alertCreated ? "alert-new" : "alert-existing", created: alertCreated }),
      resolveTokenAlerts: async () => undefined,
    },
    notifier: {
      notifyTokenAlert: async (payload) => {
        notifyCalls.push(payload);
        return true;
      },
    },
  });
}

test("token health checker notifies DingTalk for newly created alerts", async () => {
  const notifyCalls: unknown[] = [];
  const checker = createChecker(true, notifyCalls);

  await checker.checkAll();

  assert.equal(notifyCalls.length, 1);
});

test("token health checker does not notify DingTalk for existing open alerts", async () => {
  const notifyCalls: unknown[] = [];
  const checker = createChecker(false, notifyCalls);

  await checker.checkAll();

  assert.equal(notifyCalls.length, 0);
});
