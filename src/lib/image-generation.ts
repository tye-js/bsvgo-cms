export const imageGenerationPresetValues = ["custom", "main_cover"] as const;

export type ImageGenerationPreset = (typeof imageGenerationPresetValues)[number];

export const DEFAULT_IMAGE_GENERATION_PRESET: ImageGenerationPreset = "custom";

export const MAIN_COVER_IMAGE_SPEC = {
  preset: "main_cover",
  label: "主封面图",
  width: 1600,
  height: 900,
  aspectRatio: "16:9",
  sourceSize: "1536x1024",
  providerOutputFormat: "png",
  outputFormat: "webp",
  qualityMin: 80,
  qualityMax: 85,
  defaultQuality: 82,
  targetFileSizeMinBytes: 200 * 1024,
  targetFileSizeMaxBytes: 500 * 1024
} as const;

export function isImageGenerationPreset(
  value: string
): value is ImageGenerationPreset {
  return imageGenerationPresetValues.includes(value as ImageGenerationPreset);
}
