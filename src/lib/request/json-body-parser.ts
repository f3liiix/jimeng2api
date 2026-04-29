import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";

export interface ParsedJsonBody {
  body: any;
  rawBody: string;
}

export function parseByteSize(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return fallback;

  const match = String(value).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = match[2] || "b";
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  return Math.floor(amount * multipliers[unit]);
}

function cleanJsonBody(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2000-\u200B]/g, " ")
    .replace(/\uFEFF/g, "")
    .trim()
    .replace(/,(\s*[\r\n]*\s*[}\]])/g, "$1");
}

function fixJsonBody(body: string): string {
  return body
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[\r\n]*\s*[}\]])/g, "$1")
    .replace(/,+/g, ",");
}

export async function parseJsonBody(
  source: AsyncIterable<Buffer | string>,
  limitBytes: number
): Promise<ParsedJsonBody> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of source) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > limitBytes) {
      throw new APIException(EX.API_REQUEST_PARAMS_INVALID, "Request body too large", {
        httpStatusCode: 413,
        type: "invalid_request_error",
        code: "payload_too_large",
      });
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  const cleanedBody = cleanJsonBody(body);

  try {
    return {
      body: JSON.parse(cleanedBody),
      rawBody: cleanedBody,
    };
  } catch (parseError: any) {
    const fixedBody = fixJsonBody(cleanedBody);
    try {
      return {
        body: JSON.parse(fixedBody),
        rawBody: fixedBody,
      };
    } catch {
      throw new APIException(EX.API_REQUEST_PARAMS_INVALID, `Invalid JSON body: ${parseError.message}`, {
        httpStatusCode: 400,
        type: "invalid_request_error",
        code: "invalid_json",
      });
    }
  }
}
