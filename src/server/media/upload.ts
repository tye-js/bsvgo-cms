import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";

const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"]
]);

const DEFAULT_MAX_UPLOAD_SIZE_MB = 5;

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
    path.join(process.cwd(), "public", "uploads")
  );
}

function mediaBaseUrl(publicOrigin?: string) {
  const configuredBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim() || "/uploads";

  if (/^https?:\/\//i.test(configuredBase)) {
    return configuredBase;
  }

  if (configuredBase.startsWith("/") && publicOrigin) {
    return new URL(configuredBase, publicOrigin).toString();
  }

  return configuredBase;
}

function publicUrl(storageKey: string, publicOrigin?: string) {
  const base = mediaBaseUrl(publicOrigin).replace(/\/$/, "");
  return `${base}/${storageKey}`;
}

function safeOriginalName(name: string) {
  return path.basename(name).replace(/[^\w.\- ]+/g, "").slice(0, 255);
}

async function readImageSize(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }
      offset += 2 + length;
    }
  }

  if (mimeType === "image/webp" && buffer.length >= 30) {
    const signature = buffer.subarray(0, 12).toString("ascii");
    if (signature.startsWith("RIFF") && signature.endsWith("WEBP")) {
      const chunk = buffer.subarray(12, 16).toString("ascii");
      if (chunk === "VP8X" && buffer.length >= 30) {
        return {
          width: 1 + buffer.readUIntLE(24, 3),
          height: 1 + buffer.readUIntLE(27, 3)
        };
      }
    }
  }

  return { width: null, height: null };
}

export async function saveUploadedCoverImage({
  file,
  altText,
  caption,
  userId,
  publicOrigin
}: {
  file: File;
  altText: string;
  caption?: string;
  userId: string;
  publicOrigin?: string;
}) {
  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) {
    throw new Error("Only JPEG, PNG, WebP, and AVIF images are allowed.");
  }

  if (file.size <= 0) {
    throw new Error("Choose an image file to upload.");
  }

  if (file.size > maxUploadBytes()) {
    throw new Error(
      `Image must be ${Math.floor(maxUploadBytes() / 1024 / 1024)}MB or smaller.`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const storageKey = `covers/${year}/${month}/${randomUUID()}.${extension}`;
  const targetPath = path.join(uploadRoot(), storageKey);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer, { flag: "wx" });

  const imageSize = await readImageSize(buffer, file.type);
  const url = publicUrl(storageKey, publicOrigin);

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      url,
      altText: altText.trim(),
      caption: caption?.trim() ?? "",
      storageProvider: "local",
      storageKey,
      originalFilename: safeOriginalName(file.name),
      checksum,
      mimeType: file.type,
      width: imageSize.width,
      height: imageSize.height,
      fileSize: file.size,
      createdBy: userId
    })
    .returning({
      id: mediaAssets.id,
      url: mediaAssets.url,
      altText: mediaAssets.altText
    });

  return asset;
}
