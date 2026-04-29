import _ from "lodash";

import Request from "@/lib/request/Request.ts";
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import { requireAdmin } from "@/lib/auth/request-auth.ts";
import { apiKeyStore } from "@/lib/auth/api-key-store.ts";
import {
  ManagedTokenRegion,
  ManagedTokenStatus,
  tokenPool,
} from "@/lib/tokens/token-pool.ts";
import { query } from "@/lib/db/client.ts";

function invalidRequest(message: string, param?: string) {
  return new APIException(EX.API_REQUEST_PARAMS_INVALID, message, {
    httpStatusCode: 400,
    type: "invalid_request_error",
    param,
    code: "invalid_request",
  });
}

function redactApiKey(apiKey: any) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    status: apiKey.status,
    last_used_at: apiKey.lastUsedAt,
    created_at: apiKey.createdAt,
    revoked_at: apiKey.revokedAt,
  };
}

function redactToken(token: any) {
  return {
    id: token.id,
    name: token.name,
    region: token.region,
    proxy_url: token.proxyUrl,
    status: token.status,
    sort_order: token.sortOrder,
    last_checked_at: token.lastCheckedAt,
    last_error: token.lastError,
    failure_count: token.failureCount,
    created_at: token.createdAt,
    updated_at: token.updatedAt,
  };
}

function assertRegion(region: string): ManagedTokenRegion {
  if (!["cn", "us", "hk", "jp", "sg"].includes(region)) {
    throw invalidRequest("region 必须是 cn/us/hk/jp/sg 之一", "region");
  }
  return region as ManagedTokenRegion;
}

function assertStatus(status: string): ManagedTokenStatus {
  if (!["unchecked", "healthy", "unhealthy", "disabled"].includes(status)) {
    throw invalidRequest("status 必须是 unchecked/healthy/unhealthy/disabled 之一", "status");
  }
  return status as ManagedTokenStatus;
}

export default {
  prefix: "/admin/api",

  get: {
    "/api-keys": async (request: Request) => {
      requireAdmin(request);
      const apiKeys = await apiKeyStore.list();
      return { data: apiKeys.map(redactApiKey) };
    },

    "/tokens": async (request: Request) => {
      requireAdmin(request);
      const tokens = await tokenPool.list();
      return { data: tokens.map(redactToken) };
    },

    "/tasks": async (request: Request) => {
      requireAdmin(request);
      const result = await query(
        `SELECT id, object, type, status, request_payload, response_payload, error, result_url,
                api_key_id, token_id, created_at, updated_at, finished_at
         FROM tasks
         ORDER BY created_at DESC
         LIMIT 200`,
      );
      return { data: result.rows };
    },

    "/alerts": async (request: Request) => {
      requireAdmin(request);
      const result = await query(
        `SELECT id, type, severity, token_id, message, status, created_at, resolved_at
         FROM alerts
         ORDER BY created_at DESC
         LIMIT 200`,
      );
      return { data: result.rows };
    },
  },

  post: {
    "/api-keys": async (request: Request) => {
      requireAdmin(request);
      request.validate("body.name", _.isString);
      const created = await apiKeyStore.create(request.body.name);
      return {
        api_key: redactApiKey(created.apiKey),
        secret: created.secret,
      };
    },

    "/tokens": async (request: Request) => {
      requireAdmin(request);
      request
        .validate("body.name", _.isString)
        .validate("body.token", _.isString);
      const token = await tokenPool.create({
        name: request.body.name,
        token: request.body.token,
        region: assertRegion(request.body.region || "cn"),
        proxyUrl: request.body.proxy_url || null,
        sortOrder: Number.isFinite(Number(request.body.sort_order)) ? Number(request.body.sort_order) : 0,
      });
      return redactToken(token);
    },

    "/alerts/:id/resolve": async (request: Request) => {
      requireAdmin(request);
      const result = await query(
        `UPDATE alerts
         SET status = 'resolved', resolved_at = now()
         WHERE id = $1
         RETURNING id, type, severity, token_id, message, status, created_at, resolved_at`,
        [request.params.id],
      );
      if (!result.rowCount) throw invalidRequest(`Alert ${request.params.id} not found`, "id");
      return result.rows[0];
    },
  },

  put: {
    "/tokens/:id": async (request: Request) => {
      requireAdmin(request);
      const patch: any = {};
      if (request.body.name !== undefined) patch.name = String(request.body.name);
      if (request.body.token !== undefined) patch.token = String(request.body.token);
      if (request.body.region !== undefined) patch.region = assertRegion(String(request.body.region));
      if (request.body.proxy_url !== undefined) patch.proxyUrl = request.body.proxy_url || null;
      if (request.body.status !== undefined) patch.status = assertStatus(String(request.body.status));
      if (request.body.sort_order !== undefined) patch.sortOrder = Number(request.body.sort_order);
      const token = await tokenPool.update(request.params.id, patch);
      if (!token) throw invalidRequest(`Token ${request.params.id} not found`, "id");
      return redactToken(token);
    },
  },

  delete: {
    "/tokens/:id": async (request: Request) => {
      requireAdmin(request);
      await tokenPool.delete(request.params.id);
      return { deleted: true };
    },

    "/api-keys/:id": async (request: Request) => {
      requireAdmin(request);
      const apiKey = await apiKeyStore.revoke(request.params.id);
      if (!apiKey) throw invalidRequest(`API Key ${request.params.id} not found`, "id");
      return redactApiKey(apiKey);
    },
  },
};
