import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { MAIN_COVER_IMAGE_SPEC } from "@/lib/image-generation";
import { db } from "@/server/db";
import { mediaAssets, type MediaAssetVariant } from "@/server/db/schema";

const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"]
]);

const DEFAULT_MAX_UPLOAD_SIZE_MB = 5;
const VARIANT_WIDTHS = [480, 960, 1440] as const;
const VARIANT_FORMATS = ["webp", "avif"] as const;

function maxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_SIZE_MB);
  const sizeMb =
    Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_UPLOAD_SIZE_MB;
  return sizeMb * 1024 * 1024;
}

function uploadRoot() {
  return (
    process.env.UPLOAD_DIR?.trim() ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads")
  );
}

function safeUploadPath(storageKey: string) {
  const root = path.resolve(/* turbopackIgnore: true */ uploadRoot());
  const targetPath = path.resolve(/* turbopackIgnore: true */ root, storageKey);

  if (!targetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("图片存储路径无效。");
  }

  return targetPath;
}

function normalizePublicOrigin(origin?: string) {
  const trimmedOrigin = origin?.trim();
  if (!trimmedOrigin) {
    return undefined;
  }

  try {
    const url = new URL(trimmedOrigin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function mediaBaseUrl(publicOrigin?: string) {
  const configuredBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim() || "/uploads";

  if (/^https?:\/\//i.test(configuredBase)) {
    return configuredBase;
  }

  const origin =
    normalizePublicOrigin(publicOrigin) ??
    normalizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (origin) {
    const basePath = configuredBase.startsWith("/")
      ? configuredBase
      : `/${configuredBase}`;
    return new URL(basePath, origin).toString();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "请将 MEDIA_PUBLIC_BASE_URL 设置为绝对 URL，或先配置 NEXT_PUBLIC_SITE_URL 后再上传图片。"
    );
  }

  return configuredBase.startsWith("/") ? configuredBase : `/${configuredBase}`;
}

function publicUrl(storageKey: string, publicOrigin?: string) {
  const base = mediaBaseUrl(publicOrigin).replace(/\/$/, "");
  return `${base}/${storageKey}`;
}

function safeOriginalName(name: string) {
  return path.basename(name).replace(/[^\w.\- ]+/g, "").slice(0, 255);
}

function boundedText(value: string | undefined, maxLength: number) {
  return value?.trim().slice(0, maxLength) ?? "";
}

function extensionForMimeType(mimeType: string) {
  return ALLOWED_MIME_TYPES.get(mimeType) ?? "png";
}

function variantStorageKey(originalStorageKey: string, width: number, format: string) {
  const parsed = path.parse(originalStorageKey);
  return `${parsed.dir}/${parsed.name}-${width}.${format}`;
}

async function mainCoverImageBuffer(inputBuffer: Buffer) {
  const format = MAIN_COVER_IMAGE_SPEC.outputFormat;
  const qualities = [
    MAIN_COVER_IMAGE_SPEC.qualityMax,
    MAIN_COVER_IMAGE_SPEC.defaultQuality,
    MAIN_COVER_IMAGE_SPEC.qualityMin
  ];
  let bestBuffer: Buffer | null = null;
  let bestQuality: number = MAIN_COVER_IMAGE_SPEC.defaultQuality;

  for (const candidateQuality of qualities) {
    const outputBuffer = await sharp(inputBuffer)
      .resize({
        width: MAIN_COVER_IMAGE_SPEC.width,
        height: MAIN_COVER_IMAGE_SPEC.height,
        fit: "cover",
        position: "center"
      })
      .webp({ quality: candidateQuality })
      .toBuffer();
    bestBuffer = outputBuffer;
    bestQuality = candidateQuality;

    if (
      outputBuffer.length <= MAIN_COVER_IMAGE_SPEC.targetFileSizeMaxBytes ||
      candidateQuality === MAIN_COVER_IMAGE_SPEC.qualityMin
    ) {
      break;
    }
  }

  return {
    buffer: bestBuffer ?? Buffer.from(inputBuffer),
    mimeType: "image/webp",
    extension: format,
    width: MAIN_COVER_IMAGE_SPEC.width,
    height: MAIN_COVER_IMAGE_SPEC.height,
    quality: bestQuality,
    metadata: {
      preset: MAIN_COVER_IMAGE_SPEC.preset,
      label: MAIN_COVER_IMAGE_SPEC.label,
      width: MAIN_COVER_IMAGE_SPEC.width,
      height: MAIN_COVER_IMAGE_SPEC.height,
      aspectRatio: MAIN_COVER_IMAGE_SPEC.aspectRatio,
      outputFormat: format,
      quality: bestQuality,
      targetFileSizeMinBytes: MAIN_COVER_IMAGE_SPEC.targetFileSizeMinBytes,
      targetFileSizeMaxBytes: MAIN_COVER_IMAGE_SPEC.targetFileSizeMaxBytes
    }
  };
}

export async function generateImageVariants({
  buffer,
  storageKey,
  publicOrigin,
  width,
  height
}: {
  buffer: Buffer;
  storageKey: string;
  publicOrigin?: string;
  width?: number | null;
  height?: number | null;
}) {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = width ?? metadata.width ?? null;
  const originalHeight = height ?? metadata.height ?? null;

  if (!originalWidth || !originalHeight) return [];

  const variants: MediaAssetVariant[] = [];
  const outputWidths = Array.from(
    new Set(VARIANT_WIDTHS.map((targetWidth) => Math.min(targetWidth, originalWidth)))
  );

  for (const outputWidth of outputWidths) {
    const outputHeight = Math.max(
      Math.round((originalHeight / originalWidth) * outputWidth),
      1
    );

    for (const format of VARIANT_FORMATS) {
      const outputKey = variantStorageKey(storageKey, outputWidth, format);
      const outputPath = safeUploadPath(outputKey);
      await mkdir(path.dirname(/* turbopackIgnore: true */ outputPath), {
        recursive: true
      });

      const pipeline = sharp(buffer).resize({
        width: outputWidth,
        withoutEnlargement: true
      });
      const outputBuffer =
        format === "webp"
          ? await pipeline.webp({ quality: 82 }).toBuffer()
          : await pipeline.avif({ quality: 50 }).toBuffer();

      await writeFile(/* turbopackIgnore: true */ outputPath, outputBuffer);
      variants.push({
        url: publicUrl(outputKey, publicOrigin),
        storageKey: outputKey,
        format,
        width: outputWidth,
        height: outputHeight,
        fileSize: outputBuffer.length
      });
    }
  }

  return variants;
}

export async function regenerateMediaAssetVariants({
  storageKey,
  publicOrigin
}: {
  storageKey: string;
  publicOrigin?: string;
}) {
  const buffer = await readFile(
    /* turbopackIgnore: true */ safeUploadPath(storageKey)
  );
  const metadata = await sharp(buffer).metadata();
  return generateImageVariants({
    buffer,
    storageKey,
    publicOrigin,
    width: metadata.width ?? null,
    height: metadata.height ?? null
  });
}

export async function saveUploadedCoverImage({
  file,
  altText,
  caption,
  zhAltText,
  enAltText,
  zhSeoTitle,
  zhSeoDescription,
  enSeoTitle,
  enSeoDescription,
  userId,
  publicOrigin
}: {
  file: File;
  altText: string;
  caption?: string;
  zhAltText?: string;
  enAltText?: string;
  zhSeoTitle?: string;
  zhSeoDescription?: string;
  enSeoTitle?: string;
  enSeoDescription?: string;
  userId: string;
  publicOrigin?: string;
}) {
  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) {
    throw new Error("仅支持 JPEG、PNG、WebP 和 AVIF 图片。");
  }

  if (file.size <= 0) {
    throw new Error("请选择要上传的图片文件。");
  }

  if (file.size > maxUploadBytes()) {
    throw new Error(
      `图片大小不能超过 ${Math.floor(maxUploadBytes() / 1024 / 1024)}MB。`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storageKey = `covers/${year}/${month}/${randomUUID()}.${extension}`;
  const targetPath = safeUploadPath(storageKey);

  await mkdir(path.dirname(/* turbopackIgnore: true */ targetPath), {
    recursive: true
  });
  await writeFile(/* turbopackIgnore: true */ targetPath, buffer, { flag: "wx" });

  const metadata = await sharp(buffer).metadata();
  const imageSize = {
    width: metadata.width ?? null,
    height: metadata.height ?? null
  };
  const url = publicUrl(storageKey, publicOrigin);
  const trimmedAltText = boundedText(altText, 255);
  const normalizedZhAltText = boundedText(zhAltText, 255) || trimmedAltText;
  const normalizedEnAltText = boundedText(enAltText, 255);
  const normalizedAltText =
    trimmedAltText || normalizedZhAltText || normalizedEnAltText;
  const variants = await generateImageVariants({
    buffer,
    storageKey,
    publicOrigin,
    width: imageSize.width,
    height: imageSize.height
  });

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      url,
      altText: normalizedAltText,
      caption: caption?.trim() ?? "",
      zhAltText: normalizedZhAltText,
      enAltText: normalizedEnAltText,
      zhSeoTitle: boundedText(zhSeoTitle, 255),
      zhSeoDescription: boundedText(zhSeoDescription, 500),
      enSeoTitle: boundedText(enSeoTitle, 255),
      enSeoDescription: boundedText(enSeoDescription, 500),
      storageProvider: "local",
      storageKey,
      originalFilename: safeOriginalName(file.name),
      checksum,
      mimeType: file.type,
      width: imageSize.width,
      height: imageSize.height,
      fileSize: file.size,
      variants,
      createdBy: userId
    })
    .returning({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText
    });

  return asset;
}

export async function saveGeneratedCoverImage({
  buffer,
  mimeType,
  originalFilename,
  altText,
  caption,
  zhAltText,
  enAltText,
  zhSeoTitle,
  zhSeoDescription,
  enSeoTitle,
  enSeoDescription,
  userId,
  metadata,
  publicOrigin
}: {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  altText: string;
  caption?: string;
  zhAltText?: string;
  enAltText?: string;
  zhSeoTitle?: string;
  zhSeoDescription?: string;
  enSeoTitle?: string;
  enSeoDescription?: string;
  userId: string;
  metadata?: Record<string, unknown>;
  publicOrigin?: string;
}) {
  if (!buffer.length) {
    throw new Error("AI 生成的图片为空。");
  }

  const normalizedImage =
    metadata?.generationPreset === MAIN_COVER_IMAGE_SPEC.preset
      ? await mainCoverImageBuffer(buffer)
      : {
          buffer,
          mimeType,
          extension: extensionForMimeType(mimeType),
          width: null,
          height: null,
          metadata: null
        };
  const outputBuffer = normalizedImage.buffer;
  const outputMimeType = normalizedImage.mimeType;
  const extension = normalizedImage.extension;
  const checksum = createHash("sha256").update(outputBuffer).digest("hex");
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storageKey = `covers/${year}/${month}/${randomUUID()}.${extension}`;
  const targetPath = safeUploadPath(storageKey);

  await mkdir(path.dirname(/* turbopackIgnore: true */ targetPath), {
    recursive: true
  });
  await writeFile(/* turbopackIgnore: true */ targetPath, outputBuffer, {
    flag: "wx"
  });

  const imageMetadata = await sharp(outputBuffer).metadata();
  const imageSize = {
    width: normalizedImage.width ?? imageMetadata.width ?? null,
    height: normalizedImage.height ?? imageMetadata.height ?? null
  };
  const url = publicUrl(storageKey, publicOrigin);
  const trimmedAltText = boundedText(altText, 255);
  const normalizedZhAltText = boundedText(zhAltText, 255) || trimmedAltText;
  const normalizedEnAltText = boundedText(enAltText, 255);
  const normalizedAltText =
    trimmedAltText || normalizedZhAltText || normalizedEnAltText;
  const variants = await generateImageVariants({
    buffer: outputBuffer,
    storageKey,
    publicOrigin,
    width: imageSize.width,
    height: imageSize.height
  });

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      url,
      altText: normalizedAltText,
      caption: caption?.trim() ?? "",
      zhAltText: normalizedZhAltText,
      enAltText: normalizedEnAltText,
      zhSeoTitle: boundedText(zhSeoTitle, 255),
      zhSeoDescription: boundedText(zhSeoDescription, 500),
      enSeoTitle: boundedText(enSeoTitle, 255),
      enSeoDescription: boundedText(enSeoDescription, 500),
      storageProvider: "local",
      storageKey,
      originalFilename: safeOriginalName(originalFilename),
      checksum,
      mimeType: outputMimeType,
      width: imageSize.width,
      height: imageSize.height,
      fileSize: outputBuffer.length,
      variants,
      metadata: {
        ...(metadata ?? {}),
        ...(normalizedImage.metadata
          ? { outputSpec: normalizedImage.metadata }
          : {})
      },
      createdBy: userId
    })
    .returning({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText
    });

  return asset;
}
