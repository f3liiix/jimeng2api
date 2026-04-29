export function getVideoBenefitType(model: string): string {
  if (model.includes("40_pro_vision")) {
    return "seedance_20_pro_720p_output";
  }
  if (model.includes("40_vision")) {
    return "seedance_20_fast_720p_output";
  }
  if (model.includes("veo3.1")) {
    return "generate_video_veo3.1";
  }
  if (model.includes("veo3")) {
    return "generate_video_veo3";
  }
  if (model.includes("sora2")) {
    return "generate_video_sora2";
  }
  if (model.includes("40_pro")) {
    return "dreamina_video_seedance_20_pro";
  }
  if (model.includes("40")) {
    return "dreamina_seedance_20_fast";
  }
  if (model.includes("3.5_pro")) {
    return "dreamina_video_seedance_15_pro";
  }
  if (model.includes("3.5")) {
    return "dreamina_video_seedance_15";
  }
  return "basic_video_operation_vgfm_v_three";
}

export function getOmniVideoBenefitType(model: string): string {
  if (model.includes("40_pro_vision") || model.includes("40_vision")) {
    return getVideoBenefitType(model);
  }
  if (model.includes("40_pro")) {
    return "dreamina_video_seedance_20_video_add";
  }
  if (model.includes("40")) {
    return "dreamina_seedance_20_fast_with_video";
  }
  return getVideoBenefitType(model);
}
