import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.equal(getAdminRouteFromPathname("/admin/docs"), "docs");
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

test("admin shell does not render the removed admin key field", () => {
  const source = readFileSync(new URL("../admin/src/main.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("<Label>管理密钥</Label>"), false);
  assert.equal(source.includes('name="adminKey"'), false);
});

test("admin API docs use plain UUID task ids", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  assert.equal(docs.includes("task_xxxxx"), false);
  assert.doesNotMatch(docs, /task_[0-9a-f]{8}/i);
  assert.match(docs, /550e8400-e29b-41d4-a716-446655440000/);
});

test("admin API docs only document video generation endpoints", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  assert.equal(docs.includes("/v1/images/generations"), false);
  assert.equal(docs.includes("/v1/images/compositions"), false);
  assert.match(docs, /\/v1\/videos\/generations/);
});

test("admin API docs list Seedance 2.0 video model values", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  for (const model of [
    "jimeng-video-seedance-2.0",
    "jimeng-video-seedance-2.0-fast",
    "jimeng-video-seedance-2.0-vip",
    "jimeng-video-seedance-2.0-fast-vip",
  ]) {
    assert.match(docs, new RegExp(`\\\`${model}\\\``));
  }
});

test("admin API docs list supported video ratios", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  for (const ratio of ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"]) {
    assert.match(docs, new RegExp(`\\\`${ratio}\\\``));
  }
});

test("admin API docs only describe API key authentication", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  assert.doesNotMatch(docs, /session[_ ]?id/i);
  assert.match(docs, /Authorization: Bearer <API_KEY>/);
});

test("admin API docs describe defaults and task errors accurately", () => {
  const docs = readFileSync(new URL("../admin/src/docs/api-docs.md", import.meta.url), "utf8");

  assert.match(docs, /\| `model` \| string \| 否 \|/);
  assert.match(docs, /默认 `jimeng-video-3\.5-pro`/);
  assert.match(docs, /`task_not_found`/);
  assert.match(docs, /仅 `jimeng-video-3\.0` 和 `jimeng-video-3\.0-fast` 生效/);
});
