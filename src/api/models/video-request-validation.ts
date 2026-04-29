import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";

interface OmniReferenceRequestLike {
  body?: Record<string, any>;
  files?: Record<string, any>;
  filePaths?: string[];
}

export interface OmniReferenceMaterialCounts {
  imageCount: number;
  videoCount: number;
  totalCount: number;
}

export function getOmniReferenceMaterialCounts({
  body = {},
  files = {},
  filePaths = [],
}: OmniReferenceRequestLike): OmniReferenceMaterialCounts {
  let imageCount = 0;
  let videoCount = 0;

  for (const fieldName of Object.keys(files)) {
    if (isImageField(fieldName)) imageCount++;
    else if (isVideoField(fieldName)) videoCount++;
  }

  for (const [fieldName, value] of Object.entries(body)) {
    if (!isUrlField(value)) continue;
    if (isImageField(fieldName)) imageCount++;
    else if (isVideoField(fieldName)) videoCount++;
  }

  imageCount += filePaths.length;

  return {
    imageCount,
    videoCount,
    totalCount: imageCount + videoCount,
  };
}

export function hasOmniReferenceMaterials(requestLike: OmniReferenceRequestLike): boolean {
  return getOmniReferenceMaterialCounts(requestLike).totalCount > 0;
}

export function validateOmniReferenceMaterialLimits(requestLike: OmniReferenceRequestLike) {
  const { imageCount, videoCount, totalCount } = getOmniReferenceMaterialCounts(requestLike);

  if (imageCount > 9) {
    throw invalidRequest("全能模式最多上传9张图片", "image_file");
  }
  if (videoCount > 3) {
    throw invalidRequest("全能模式最多上传3个视频", "video_file");
  }
  if (totalCount > 12) {
    throw invalidRequest("全能模式图片+视频总数不超过12个");
  }
}

function isImageField(fieldName: string) {
  return fieldName === "image_file" || fieldName.startsWith("image_file_");
}

function isVideoField(fieldName: string) {
  return fieldName === "video_file" || fieldName.startsWith("video_file_");
}

function isUrlField(value: unknown) {
  return typeof value === "string" && value.startsWith("http");
}

function invalidRequest(message: string, param?: string) {
  return new APIException(EX.API_REQUEST_PARAMS_INVALID, message, {
    httpStatusCode: 400,
    type: "invalid_request_error",
    param,
    code: "invalid_request",
  });
}
