import assert from "node:assert/strict";
import test from "node:test";

import APIException from "../src/lib/exceptions/APIException.ts";
import EX from "../src/api/consts/exceptions.ts";
import { runWithTokenRetry } from "../src/lib/tokens/token-retry.ts";
import type { AcquiredToken } from "../src/lib/tokens/token-pool.ts";

const firstToken: AcquiredToken = { id: "token-1", name: "账号1", value: "session-1", region: "cn" };
const secondToken: AcquiredToken = { id: "token-2", name: "账号2", value: "session-2", region: "cn" };

test("token retry switches account once when session expires", async () => {
  const attempts: string[] = [];
  const updates: string[] = [];
  const result = await runWithTokenRetry({
    initialToken: firstToken,
    acquireNextToken: async ({ excludeTokenIds }) => {
      assert.deepEqual(excludeTokenIds, ["token-1"]);
      return secondToken;
    },
    onTokenChange: async (token) => {
      updates.push(token.id);
    },
    run: async (token) => {
      attempts.push(token.id);
      if (token.id === "token-1") {
        throw new APIException(EX.API_TOKEN_EXPIRES, "[登录失效]: session expired");
      }
      return "ok";
    },
  });

  assert.equal(result, "ok");
  assert.deepEqual(attempts, ["token-1", "token-2"]);
  assert.deepEqual(updates, ["token-2"]);
});

test("token retry does not switch account for content violations", async () => {
  const attempts: string[] = [];
  await assert.rejects(
    runWithTokenRetry({
      initialToken: firstToken,
      acquireNextToken: async () => secondToken,
      run: async (token) => {
        attempts.push(token.id);
        throw new APIException(EX.API_CONTENT_FILTERED, "[内容违规]: risk not pass");
      },
    }),
    (error: any) => error?.errcode === EX.API_CONTENT_FILTERED[0],
  );

  assert.deepEqual(attempts, ["token-1"]);
});

test("token retry does not retry more than once", async () => {
  const attempts: string[] = [];
  await assert.rejects(
    runWithTokenRetry({
      initialToken: firstToken,
      acquireNextToken: async () => secondToken,
      run: async (token) => {
        attempts.push(token.id);
        throw new APIException(EX.API_TOKEN_EXPIRES, "[登录失效]: session expired");
      },
    }),
    (error: any) => error?.errcode === EX.API_TOKEN_EXPIRES[0],
  );

  assert.deepEqual(attempts, ["token-1", "token-2"]);
});
