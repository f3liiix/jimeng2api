import { query } from "@/lib/db/client.ts";
import {
  ApiKeyRecord,
  createApiKeySecret,
  hashApiKey,
} from "@/lib/auth/api-keys.ts";

function mapApiKeyRow(row: any): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    status: row.status,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export class ApiKeyStore {
  async list() {
    const result = await query(
      `SELECT id, name, key_hash, status, last_used_at, created_at, revoked_at
       FROM api_keys
       ORDER BY created_at DESC`,
    );
    return result.rows.map(mapApiKeyRow);
  }

  async create(name: string) {
    const secret = createApiKeySecret();
    const result = await query(
      `INSERT INTO api_keys (name, key_hash)
       VALUES ($1, $2)
       RETURNING id, name, key_hash, status, last_used_at, created_at, revoked_at`,
      [name, hashApiKey(secret)],
    );
    return {
      apiKey: mapApiKeyRow(result.rows[0]),
      secret,
    };
  }

  async ensureInitial(name: string, secret: string) {
    const keyHash = hashApiKey(secret);
    const result = await query(
      `INSERT INTO api_keys (name, key_hash)
       VALUES ($1, $2)
       ON CONFLICT (key_hash) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, key_hash, status, last_used_at, created_at, revoked_at`,
      [name, keyHash],
    );
    return mapApiKeyRow(result.rows[0]);
  }

  async findActiveBySecret(secret: string) {
    const result = await query(
      `SELECT id, name, key_hash, status, last_used_at, created_at, revoked_at
       FROM api_keys
       WHERE key_hash = $1 AND status = 'active'
       LIMIT 1`,
      [hashApiKey(secret)],
    );
    if (!result.rowCount) return null;
    await query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [result.rows[0].id]);
    return mapApiKeyRow(result.rows[0]);
  }

  async revoke(id: string) {
    const result = await query(
      `UPDATE api_keys
       SET status = 'revoked', revoked_at = now()
       WHERE id = $1
       RETURNING id, name, key_hash, status, last_used_at, created_at, revoked_at`,
      [id],
    );
    return result.rowCount ? mapApiKeyRow(result.rows[0]) : null;
  }
}

export const apiKeyStore = new ApiKeyStore();
