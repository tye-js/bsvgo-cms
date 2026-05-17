import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
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
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const altText = formText(formData, "altText");
  const caption = formText(formData, "caption");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择图片文件。" }, { status: 400 });
  }

  if (altText.length > 255) {
    return NextResponse.json(
      { error: "替代文本不能超过 255 个字符。" },
      { status: 400 }
    );
  }

  try {
    const asset = await saveUploadedCoverImage({
      file,
      altText,
      caption,
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
