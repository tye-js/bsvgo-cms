import { NextResponse } from "next/server";

import { mediaAssetSchema } from "@/lib/validators";
import { requireContentEditor } from "@/server/auth/session";
import { saveUploadedCoverImage } from "@/server/media/upload";

export const runtime = "nodejs";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function requestOrigin(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || new URL(request.url).protocol.replace(/:$/, "");
    return `${protocol}://${host}`;
  }

  return request.headers.get("origin") ?? undefined;
}

export async function POST(request: Request) {
  const user = await requireContentEditor();
  const formData = await request.formData();
  const file = formData.get("file");
  const altText = formText(formData, "altText");
  const caption = formText(formData, "caption");
  const zhAltText = formText(formData, "zhAltText");
  const enAltText = formText(formData, "enAltText");
  const zhSeoTitle = formText(formData, "zhSeoTitle");
  const zhSeoDescription = formText(formData, "zhSeoDescription");
  const enSeoTitle = formText(formData, "enSeoTitle");
  const enSeoDescription = formText(formData, "enSeoDescription");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择图片文件。" }, { status: 400 });
  }

  const parsedMetadata = mediaAssetSchema.omit({ url: true }).safeParse({
    altText,
    caption,
    zhAltText,
    enAltText,
    zhSeoTitle,
    zhSeoDescription,
    enSeoTitle,
    enSeoDescription
  });

  if (!parsedMetadata.success) {
    return NextResponse.json(
      { error: parsedMetadata.error.issues[0]?.message ?? "媒体信息无效。" },
      { status: 400 }
    );
  }

  try {
    const asset = await saveUploadedCoverImage({
      file,
      altText: parsedMetadata.data.altText ?? "",
      caption: parsedMetadata.data.caption,
      zhAltText: parsedMetadata.data.zhAltText,
      enAltText: parsedMetadata.data.enAltText,
      zhSeoTitle: parsedMetadata.data.zhSeoTitle,
      zhSeoDescription: parsedMetadata.data.zhSeoDescription,
      enSeoTitle: parsedMetadata.data.enSeoTitle,
      enSeoDescription: parsedMetadata.data.enSeoDescription,
      userId: user.id,
      publicOrigin: requestOrigin(request)
    });

    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "图片上传失败。"
      },
      { status: 400 }
    );
  }
}
