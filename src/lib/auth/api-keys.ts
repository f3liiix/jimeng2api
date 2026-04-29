import crypto from "node:crypto";

const API_KEY_PREFIX = "jm_";

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyHash: string;
  status: "active" | "revoked";
  lastUsedAt?: Date | null;
  createdAt: Date;
  revokedAt?: Date | null;
}

export function createApiKeySecret() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(secret: string) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifyApiKeyHash(secret: string, hash: string) {
  const candidate = hashApiKey(secret);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
