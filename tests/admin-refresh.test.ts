import assert from "node:assert/strict";
import test from "node:test";

import {
  displayTypeLabels,
  getAdminRouteFromPathname,
  getTaskRefreshIntervalMs,
  mergeCreatedApiKey,
  taskTableColumns,
} from "../admin/src/refresh.ts";

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

test("task table shows caller and account names with status next to error", () => {
  assert.deepEqual(taskTableColumns, [
    "id",
    "type",
    "api_key_name",
    "token_name",
    "created_at",
    "updated_at",
    "status",
    "error",
  ]);
});

test("task type identifiers are displayed in Chinese", () => {
  assert.equal(displayTypeLabels.image_generation, "图片生成");
  assert.equal(displayTypeLabels.image_composition, "图片合成");
  assert.equal(displayTypeLabels.video_generation, "视频生成");
});

test("created API key is shown immediately at the top of the table", () => {
  const existing = [
    { id: "old", name: "old caller" },
    { id: "same", name: "stale caller" },
  ];
  const created = { id: "same", name: "new caller", api_key: "jm_new" };

  assert.deepEqual(mergeCreatedApiKey(existing, created), [
    created,
    { id: "old", name: "old caller" },
  ]);
  assert.equal(mergeCreatedApiKey(existing, null), existing);
});
