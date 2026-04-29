import { query } from "@/lib/db/client.ts";
import {
  ApiKeyRecord,
  createApiKeySecret,
  decryptApiKeySecret,
  encryptApiKeySecret,
  hashApiKey,
} from "@/lib/auth/api-keys.ts";

function mapApiKeyRow(row: any, options: { includeSecret?: boolean } = {}): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyCiphertext: row.key_ciphertext,
    secret: options.includeSecret && row.key_ciphertext ? decryptApiKeySecret(row.key_ciphertext) : null,
    status: row.status,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export class ApiKeyStore {
  async list() {
    const result = await query(
      `SELECT id, name, key_hash, key_ciphertext, status, last_used_at, created_at, revoked_at
       FROM api_keys
       ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => mapApiKeyRow(row, { includeSecret: true }));
  }

  async create(name: string) {
    const secret = createApiKeySecret();
    const result = await query(
      `INSERT INTO api_keys (name, key_hash, key_ciphertext)
       VALUES ($1, $2, $3)
       RETURNING id, name, key_hash, key_ciphertext, status, last_used_at, created_at, revoked_at`,
      [name, hashApiKey(secret), encryptApiKeySecret(secret)],
    );
    return {
      apiKey: mapApiKeyRow(result.rows[0], { includeSecret: true }),
      secret,
    };
  }

  async findActiveBySecret(secret: string) {
    const result = await query(
      `SELECT id, name, key_hash, key_ciphertext, status, last_used_at, created_at, revoked_at
       FROM api_keys
       WHERE key_hash = $1 AND status = 'active'
       LIMIT 1`,
      [hashApiKey(secret)],
    );
    if (!result.rowCount) return null;
    await query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [result.rows[0].id]);
    return mapApiKeyRow(result.rows[0]);
  }

  async delete(id: string) {
    const result = await query(
      `DELETE FROM api_keys
       WHERE id = $1
       RETURNING id, name, key_hash, key_ciphertext, status, last_used_at, created_at, revoked_at`,
      [id],
    );
    return result.rowCount ? mapApiKeyRow(result.rows[0], { includeSecret: true }) : null;
  }
}

export const apiKeyStore = new ApiKeyStore();
