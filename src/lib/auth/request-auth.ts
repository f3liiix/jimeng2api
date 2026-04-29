import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import Request from "@/lib/request/Request.ts";
import { apiKeyStore } from "@/lib/auth/api-key-store.ts";
import { isDatabaseConfigured } from "@/lib/db/client.ts";

export function extractBearerToken(authorization?: string) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function authError(message: string) {
  return new APIException(EX.API_TOKEN_EXPIRES, message, {
    httpStatusCode: 401,
    type: "authentication_error",
    code: "invalid_api_key",
  });
}

export async function authenticateApiKey(request: Request) {
  if (!isDatabaseConfigured()) {
    throw new APIException(EX.API_REQUEST_FAILED, "DATABASE_URL 未配置，无法校验 API Key");
  }

  const secret = extractBearerToken(request.headers.authorization);
  if (!secret) throw authError("缺少 API Key，请使用 Authorization: Bearer <api_key>");

  const apiKey = await apiKeyStore.findActiveBySecret(secret);
  if (!apiKey) throw authError("API Key 无效或已被停用");
  return apiKey;
}

export function requireAdmin(request: Request) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    throw new APIException(EX.API_TOKEN_EXPIRES, "ADMIN_API_KEY 未配置，管理接口不可用", {
      httpStatusCode: 401,
      type: "authentication_error",
      code: "admin_auth_not_configured",
    });
  }
  const provided = request.headers["x-admin-key"] || extractBearerToken(request.headers.authorization);
  if (provided !== configured) {
    throw new APIException(EX.API_TOKEN_EXPIRES, "管理 API Key 无效", {
      httpStatusCode: 401,
      type: "authentication_error",
      code: "invalid_admin_key",
    });
  }
}
