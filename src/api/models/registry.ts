import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODEL_MAP,
  IMAGE_MODEL_MAP_ASIA,
  IMAGE_MODEL_MAP_US,
  VIDEO_MODEL_MAP,
  VIDEO_MODEL_MAP_ASIA,
  VIDEO_MODEL_MAP_US,
} from "@/api/consts/common.ts";

export interface RegionLike {
  isUS: boolean;
  isHK: boolean;
  isJP: boolean;
  isSG: boolean;
  isInternational: boolean;
  isCN: boolean;
}

export interface PublicModel {
  id: string;
  object: "model";
  owned_by: "jimeng2api";
  type: "image" | "video";
  regions: string[];
}

export interface ResolvedModel {
  model: string;
  userModel: string;
}

const IMAGE_MODELS = {
  CN: IMAGE_MODEL_MAP,
  US: IMAGE_MODEL_MAP_US,
  ASIA: IMAGE_MODEL_MAP_ASIA,
};

const VIDEO_MODELS = {
  CN: VIDEO_MODEL_MAP,
  US: VIDEO_MODEL_MAP_US,
  ASIA: VIDEO_MODEL_MAP_ASIA,
};

export function listModels(): PublicModel[] {
  const models = new Map<string, PublicModel>();
  addModels(models, IMAGE_MODELS.CN, "image", "CN");
  addModels(models, IMAGE_MODELS.US, "image", "US");
  addModels(models, IMAGE_MODELS.ASIA, "image", "HK/JP/SG");
  addModels(models, VIDEO_MODELS.CN, "video", "CN");
  addModels(models, VIDEO_MODELS.US, "video", "US");
  addModels(models, VIDEO_MODELS.ASIA, "video", "HK/JP/SG");
  return [...models.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveImageModel(model: string | undefined, regionInfo: RegionLike): ResolvedModel {
  const modelMap = getImageModelMap(regionInfo);
  const requestedModel = model || DEFAULT_IMAGE_MODEL;
  const mappedModel = modelMap[requestedModel];
  if (!mappedModel) {
    throw unsupportedModel("image", requestedModel, Object.keys(modelMap));
  }
  return { model: mappedModel, userModel: requestedModel };
}

export function resolveVideoModel(model: string | undefined, regionInfo: RegionLike): string {
  const modelMap = getVideoModelMap(regionInfo);
  const requestedModel = model || DEFAULT_VIDEO_MODEL;
  const mappedModel = modelMap[requestedModel];
  if (!mappedModel) {
    throw unsupportedModel("video", requestedModel, Object.keys(modelMap));
  }
  return mappedModel;
}

function getImageModelMap(regionInfo: RegionLike): Record<string, string> {
  if (regionInfo.isUS) return IMAGE_MODELS.US;
  if (regionInfo.isHK || regionInfo.isJP || regionInfo.isSG) return IMAGE_MODELS.ASIA;
  return IMAGE_MODELS.CN;
}

function getVideoModelMap(regionInfo: RegionLike): Record<string, string> {
  if (regionInfo.isUS) return VIDEO_MODELS.US;
  if (regionInfo.isHK || regionInfo.isJP || regionInfo.isSG) return VIDEO_MODELS.ASIA;
  return VIDEO_MODELS.CN;
}

function addModels(
  target: Map<string, PublicModel>,
  modelMap: Record<string, string>,
  type: "image" | "video",
  region: string
) {
  for (const id of Object.keys(modelMap)) {
    const existing = target.get(id);
    if (existing) {
      if (!existing.regions.includes(region)) existing.regions.push(region);
      continue;
    }
    target.set(id, {
      id,
      object: "model",
      owned_by: "jimeng2api",
      type,
      regions: [region],
    });
  }
}

function unsupportedModel(type: "image" | "video", model: string, supportedModels: string[]) {
  return new APIException(
    EX.API_REQUEST_PARAMS_INVALID,
    `Unsupported ${type} model "${model}". Supported models: ${supportedModels.join(", ")}`,
    {
      httpStatusCode: 400,
      type: "invalid_request_error",
      param: "model",
      code: "unsupported_model",
    }
  );
}
