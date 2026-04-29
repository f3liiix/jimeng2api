import assert from "node:assert/strict";
import test from "node:test";

import { getAdminRouteFromPathname, getTaskRefreshIntervalMs } from "../admin/src/refresh.ts";

test("admin route parser maps supported paths to pages", () => {
  assert.equal(getAdminRouteFromPathname("/admin"), "tokens");
  assert.equal(getAdminRouteFromPathname("/admin/"), "tokens");
  assert.equal(getAdminRouteFromPathname("/admin/tokens"), "tokens");
  assert.equal(getAdminRouteFromPathname("/admin/api-keys"), "api-keys");
  assert.equal(getAdminRouteFromPathname("/admin/tasks"), "tasks");
  assert.equal(getAdminRouteFromPathname("/admin/alerts"), "alerts");
});

test("admin route parser falls back to tokens for unknown paths", () => {
  assert.equal(getAdminRouteFromPathname("/admin/unknown"), "tokens");
  assert.equal(getAdminRouteFromPathname("/not-admin/tasks"), "tokens");
});

test("task refresh interval is faster while tasks are active", () => {
  assert.equal(getTaskRefreshIntervalMs([{ status: "running" }]), 10_000);
  assert.equal(getTaskRefreshIntervalMs([{ status: "queued" }]), 10_000);
});

test("task refresh interval slows down when there are no active tasks", () => {
  assert.equal(getTaskRefreshIntervalMs([]), 60_000);
  assert.equal(getTaskRefreshIntervalMs([{ status: "succeeded" }, { status: "failed" }]), 60_000);
});
