import assert from "node:assert/strict";
import test from "node:test";

import { isAdminApiPath } from "../src/lib/admin-static-path.ts";

test("admin api path matcher only matches the API prefix boundary", () => {
  assert.equal(isAdminApiPath("/admin/api"), true);
  assert.equal(isAdminApiPath("/admin/api/config"), true);
  assert.equal(isAdminApiPath("/admin/api-keys"), false);
  assert.equal(isAdminApiPath("/admin/api-keys/"), false);
});
