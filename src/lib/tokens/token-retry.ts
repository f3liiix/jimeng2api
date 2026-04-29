import EX from "@/api/consts/exceptions.ts";
import type { AcquireNextOptions, AcquiredToken } from "@/lib/tokens/token-pool.ts";

export function isTokenExpiredError(error: any) {
  if (!error) return false;
  if (typeof error.compare === "function" && error.compare(EX.API_TOKEN_EXPIRES)) return true;
  if (error.errcode === EX.API_TOKEN_EXPIRES[0]) return true;

  const message = String(error.message || error.errmsg || "").toLowerCase();
  return [
    "登录失效",
    "session expired",
    "sessionid expired",
    "token expired",
    "token已失效",
  ].some((keyword) => message.includes(keyword));
}

export async function runWithTokenRetry<T>(options: {
  initialToken: AcquiredToken;
  acquireNextToken: (options: AcquireNextOptions) => Promise<AcquiredToken>;
  run: (token: AcquiredToken, attempt: number) => Promise<T>;
  onTokenChange?: (token: AcquiredToken) => Promise<void> | void;
}) {
  try {
    return await options.run(options.initialToken, 0);
  } catch (error) {
    if (!isTokenExpiredError(error)) throw error;

    const retryToken = await options.acquireNextToken({
      excludeTokenIds: [options.initialToken.id],
    });
    await options.onTokenChange?.(retryToken);
    return await options.run(retryToken, 1);
  }
}
