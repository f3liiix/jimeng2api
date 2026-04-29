import assert from "node:assert/strict";
import test from "node:test";

import { getTaskRefreshIntervalMs } from "../admin/src/refresh.ts";

test("task refresh interval is faster while tasks are active", () => {
  assert.equal(getTaskRefreshIntervalMs([{ status: "running" }]), 10_000);
  assert.equal(getTaskRefreshIntervalMs([{ status: "queued" }]), 10_000);
});

test("task refresh interval slows down when there are no active tasks", () => {
  assert.equal(getTaskRefreshIntervalMs([]), 60_000);
  assert.equal(getTaskRefreshIntervalMs([{ status: "succeeded" }, { status: "failed" }]), 60_000);
});
