import logger from "@/lib/logger.ts";
import { isDatabaseConfigured } from "@/lib/db/client.ts";
import { apiKeyStore } from "@/lib/auth/api-key-store.ts";

export async function bootstrapAuth() {
  if (!isDatabaseConfigured()) return;
  const initialKey = process.env.INITIAL_API_KEY;
  if (!initialKey) return;

  const name = process.env.INITIAL_API_KEY_NAME || "default";
  await apiKeyStore.ensureInitial(name, initialKey);
  logger.success(`初始化 API Key 已同步: ${name}`);
}
