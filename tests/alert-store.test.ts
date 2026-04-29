import assert from "node:assert/strict";
import test from "node:test";

import { AlertStore } from "../src/lib/alerts/alert-store.ts";

test("openTokenAlert reports existing open alerts as not newly created", async () => {
  const queries: string[] = [];
  const store = new AlertStore(async (sql: string) => {
    queries.push(sql);
    if (/SELECT id/i.test(sql)) return { rowCount: 1, rows: [{ id: "alert-existing" }] };
    return { rowCount: 1, rows: [] };
  });

  assert.deepEqual(await store.openTokenAlert("token-1", "still unhealthy"), {
    id: "alert-existing",
    created: false,
  });
  assert.equal(queries.some((sql) => /UPDATE alerts/i.test(sql)), true);
  assert.equal(queries.some((sql) => /INSERT INTO alerts/i.test(sql)), false);
});

test("openTokenAlert reports inserted alerts as newly created", async () => {
  const queries: string[] = [];
  const store = new AlertStore(async (sql: string) => {
    queries.push(sql);
    if (/SELECT id/i.test(sql)) return { rowCount: 0, rows: [] };
    return { rowCount: 1, rows: [{ id: "alert-created" }] };
  });

  assert.deepEqual(await store.openTokenAlert("token-1", "became unhealthy"), {
    id: "alert-created",
    created: true,
  });
  assert.equal(queries.some((sql) => /INSERT INTO alerts/i.test(sql) && /RETURNING id/i.test(sql)), true);
});
