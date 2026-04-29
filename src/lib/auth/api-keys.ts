import crypto from "node:crypto";

const API_KEY_PREFIX = "jm_";

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyHash: string;
  keyCiphertext?: string | null;
  secret?: string | null;
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

function getApiKeyEncryptionKey(secret = process.env.API_KEY_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY || process.env.APP_SECRET) {
  if (!secret) {
    throw new Error("API_KEY_ENCRYPTION_KEY, TOKEN_ENCRYPTION_KEY, or APP_SECRET must be configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKeySecret(secret: string, encryptionSecret?: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getApiKeyEncryptionKey(encryptionSecret), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptApiKeySecret(ciphertext: string, encryptionSecret?: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = ciphertext.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted API key format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getApiKeyEncryptionKey(encryptionSecret),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function verifyApiKeyHash(secret: string, hash: string) {
  const candidate = hashApiKey(secret);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
