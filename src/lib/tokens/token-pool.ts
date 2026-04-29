import crypto from "node:crypto";
import { PoolClient } from "pg";

import { query, transaction } from "@/lib/db/client.ts";

export type ManagedTokenRegion = "cn" | "us" | "hk" | "jp" | "sg";
export type ManagedTokenStatus = "unchecked" | "healthy" | "unhealthy" | "disabled";

export interface TokenCandidate {
  id: string;
  sortOrder: number;
}

export interface ManagedToken {
  id: string;
  name: string;
  token: string;
  region: ManagedTokenRegion;
  proxyUrl?: string | null;
  status: ManagedTokenStatus;
  sortOrder: number;
  lastCheckedAt?: Date | null;
  lastError?: string | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcquiredToken {
  id: string;
  name: string;
  value: string;
  region: ManagedTokenRegion;
}

const ROTATION_SCOPE = "default";

function getEncryptionKey(secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.APP_SECRET) {
  if (!secret) {
    throw new Error("TOKEN_ENCRYPTION_KEY or APP_SECRET must be configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string, secret?: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptToken(ciphertext: string, secret?: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = ciphertext.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid token ciphertext");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(secret),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function formatManagedToken(input: {
  token: string;
  region: ManagedTokenRegion;
  proxyUrl?: string | null;
}) {
  const regionPrefix = input.region === "cn" ? "" : `${input.region}-`;
  const token = `${regionPrefix}${input.token}`;
  return input.proxyUrl ? `${input.proxyUrl}@${token}` : token;
}

export function selectNextToken<T extends TokenCandidate>(tokens: T[], lastTokenId: string | null): T | null {
  if (!tokens.length) return null;
  const sorted = [...tokens].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const lastIndex = lastTokenId ? sorted.findIndex((token) => token.id === lastTokenId) : -1;
  return sorted[(lastIndex + 1) % sorted.length];
}

function mapTokenRow(row: any): ManagedToken {
  const plaintext = decryptToken(row.token_ciphertext);
  return {
    id: row.id,
    name: row.name,
    token: plaintext,
    region: row.region,
    proxyUrl: row.proxy_url,
    status: row.status,
    sortOrder: row.sort_order,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadSelectableTokens(client: PoolClient) {
  const result = await client.query(
    `SELECT id, sort_order
     FROM managed_tokens
     WHERE status IN ('unchecked', 'healthy')
     ORDER BY sort_order ASC, id ASC
     FOR UPDATE`,
  );
  return result.rows.map((row) => ({ id: row.id, sortOrder: row.sort_order }));
}

export class TokenPool {
  async list(): Promise<ManagedToken[]> {
    const result = await query(
      `SELECT *
       FROM managed_tokens
       ORDER BY sort_order ASC, created_at ASC`,
    );
    return result.rows.map(mapTokenRow);
  }

  async create(input: {
    name: string;
    token: string;
    region: ManagedTokenRegion;
    proxyUrl?: string | null;
    sortOrder?: number;
  }): Promise<ManagedToken> {
    const result = await query(
      `INSERT INTO managed_tokens (name, token_ciphertext, region, proxy_url, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name,
        encryptToken(input.token),
        input.region,
        input.proxyUrl || null,
        input.sortOrder ?? 0,
      ],
    );
    return mapTokenRow(result.rows[0]);
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      token: string;
      region: ManagedTokenRegion;
      proxyUrl: string | null;
      status: ManagedTokenStatus;
      sortOrder: number;
      lastCheckedAt: Date | null;
      lastError: string | null;
      failureCount: number;
    }>,
  ): Promise<ManagedToken | null> {
    const fields: string[] = [];
    const values: any[] = [];
    const add = (field: string, value: any) => {
      values.push(value);
      fields.push(`${field} = $${values.length}`);
    };

    if (input.name !== undefined) add("name", input.name);
    if (input.token !== undefined) add("token_ciphertext", encryptToken(input.token));
    if (input.region !== undefined) add("region", input.region);
    if (input.proxyUrl !== undefined) add("proxy_url", input.proxyUrl);
    if (input.status !== undefined) add("status", input.status);
    if (input.sortOrder !== undefined) add("sort_order", input.sortOrder);
    if (input.lastCheckedAt !== undefined) add("last_checked_at", input.lastCheckedAt);
    if (input.lastError !== undefined) add("last_error", input.lastError);
    if (input.failureCount !== undefined) add("failure_count", input.failureCount);

    if (!fields.length) {
      const existing = await query("SELECT * FROM managed_tokens WHERE id = $1", [id]);
      return existing.rowCount ? mapTokenRow(existing.rows[0]) : null;
    }

    values.push(id);
    const result = await query(
      `UPDATE managed_tokens
       SET ${fields.join(", ")}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );
    return result.rowCount ? mapTokenRow(result.rows[0]) : null;
  }

  async delete(id: string) {
    await query("DELETE FROM managed_tokens WHERE id = $1", [id]);
  }

  async acquireNext(): Promise<AcquiredToken> {
    return transaction(async (client) => {
      await client.query(
        `INSERT INTO token_rotation_state (scope)
         VALUES ($1)
         ON CONFLICT (scope) DO NOTHING`,
        [ROTATION_SCOPE],
      );
      const state = await client.query(
        `SELECT last_token_id
         FROM token_rotation_state
         WHERE scope = $1
         FOR UPDATE`,
        [ROTATION_SCOPE],
      );
      const candidates = await loadSelectableTokens(client);
      const selected = selectNextToken(candidates, state.rows[0]?.last_token_id || null);
      if (!selected) throw new Error("No healthy managed tokens available");

      await client.query(
        `UPDATE token_rotation_state
         SET last_token_id = $1, updated_at = now()
         WHERE scope = $2`,
        [selected.id, ROTATION_SCOPE],
      );
      const tokenResult = await client.query("SELECT * FROM managed_tokens WHERE id = $1", [selected.id]);
      const token = mapTokenRow(tokenResult.rows[0]);
      return {
        id: token.id,
        name: token.name,
        value: formatManagedToken(token),
        region: token.region,
      };
    });
  }
}

export const tokenPool = new TokenPool();
