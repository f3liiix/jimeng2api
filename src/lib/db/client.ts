import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import config from "@/lib/config.ts";

let pool: Pool | null = null;

export function isDatabaseConfigured() {
  return config.database.enabled;
}

export function getPool() {
  if (!config.database.url) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: any[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
