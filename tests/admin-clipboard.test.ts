import assert from "node:assert/strict";
import test from "node:test";

import { copyText } from "../admin/src/clipboard.ts";

test("copyText falls back when async clipboard API is unavailable", async () => {
  let appended = false;
  let removed = false;
  let selected = false;
  let command = "";
  const textarea = {
    value: "",
    style: {} as Record<string, string>,
    select() {
      selected = true;
    },
    setSelectionRange(start: number, end: number) {
      assert.equal(start, 0);
      assert.equal(end, "jm_test-key".length);
    },
    remove() {
      removed = true;
    },
  };

  const copied = await copyText("jm_test-key", {
    navigator: {},
    document: {
      body: {
        appendChild(node) {
          assert.equal(node, textarea);
          appended = true;
        },
      },
      createElement(tagName) {
        assert.equal(tagName, "textarea");
        return textarea;
      },
      execCommand(nextCommand) {
        command = nextCommand;
        return true;
      },
    },
  });

  assert.equal(copied, true);
  assert.equal(textarea.value, "jm_test-key");
  assert.equal(appended, true);
  assert.equal(selected, true);
  assert.equal(command, "copy");
  assert.equal(removed, true);
});
