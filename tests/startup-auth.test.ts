import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("startup does not create an initial API key from environment", () => {
  const startupSource = readFileSync("src/index.ts", "utf8");

  assert.doesNotMatch(startupSource, /bootstrapAuth/);
});
