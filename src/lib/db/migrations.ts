import fs from "fs-extra";
import path from "node:path";

import config from "@/lib/config.ts";
import logger from "@/lib/logger.ts";
import { getPool, isDatabaseConfigured, transaction } from "@/lib/db/client.ts";

const MIGRATIONS_DIR = path.join(path.resolve(), "migrations");

export async function runMigrations() {
  if (!isDatabaseConfigured()) {
    logger.warn("DATABASE_URL 未配置，数据库功能不会启用");
    return;
  }
  if (!config.database.migrationsEnabled) {
    logger.info("数据库迁移已禁用");
    return;
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  if (!fs.pathExistsSync(MIGRATIONS_DIR)) return;
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const existing = await getPool().query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [version],
    );
    if (existing.rowCount) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await transaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    });
    logger.success(`数据库迁移完成: ${file}`);
  }
}
