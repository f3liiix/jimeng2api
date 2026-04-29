import assert from "node:assert/strict";
import test from "node:test";

import {
  hashApiKey,
  verifyApiKeyHash,
  createApiKeySecret,
} from "../src/lib/auth/api-keys.ts";
import {
  decryptToken,
  encryptToken,
  formatManagedToken,
  selectNextToken,
  type TokenCandidate,
} from "../src/lib/tokens/token-pool.ts";
import { isAccountInfoLive } from "../src/api/controllers/core.ts";

test("api key secrets are hashed and verified without storing plaintext", () => {
  const secret = createApiKeySecret();
  const hash = hashApiKey(secret);

  assert.match(secret, /^jm_/);
  assert.notEqual(hash, secret);
  assert.equal(verifyApiKeyHash(secret, hash), true);
  assert.equal(verifyApiKeyHash(`${secret}x`, hash), false);
});

test("managed tokens are encrypted at rest and decrypted for upstream calls", () => {
  const ciphertext = encryptToken("session-secret", "test-secret");

  assert.notEqual(ciphertext, "session-secret");
  assert.equal(decryptToken(ciphertext, "test-secret"), "session-secret");
});

test("managed token formatting reconstructs proxy and region prefixes", () => {
  assert.equal(
    formatManagedToken({
      token: "abc",
      region: "us",
      proxyUrl: "http://127.0.0.1:7890",
    }),
    "http://127.0.0.1:7890@us-abc",
  );
  assert.equal(formatManagedToken({ token: "abc", region: "cn" }), "abc");
});

test("round robin selection advances from the last token and wraps", () => {
  const tokens: TokenCandidate[] = [
    { id: "token-1", sortOrder: 1 },
    { id: "token-2", sortOrder: 2 },
    { id: "token-3", sortOrder: 3 },
  ];

  assert.equal(selectNextToken(tokens, null)?.id, "token-1");
  assert.equal(selectNextToken(tokens, "token-1")?.id, "token-2");
  assert.equal(selectNextToken(tokens, "token-3")?.id, "token-1");
  assert.equal(selectNextToken(tokens, "unknown")?.id, "token-1");
});

test("account info response without user_id is treated as live when profile data exists", () => {
  assert.equal(
    isAccountInfoLive({
      app_id: 513695,
      app_user_info: { contact_email: "" },
      avatar_url: "https://example.com/avatar.jpeg",
      connects: [{ platform: "aweme_v2" }],
    }),
    true,
  );
});

test("wrapped account info response is treated as live when profile data exists", () => {
  assert.equal(
    isAccountInfoLive({
      data: {
        app_id: 513695,
        app_user_info: { contact_email: "" },
        avatar_url: "https://example.com/avatar.jpeg",
      },
    }),
    true,
  );
});
