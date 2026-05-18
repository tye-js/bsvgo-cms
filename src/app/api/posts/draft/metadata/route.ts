import { NextResponse } from "next/server";

import { aiDraftMetadataSchema } from "@/lib/validators";
import { generateDraftMetadata } from "@/server/ai/openai";
import { getCurrentUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "登录状态已失效，请重新登录后再试。" },
      { status: 401 }
    );
  }

  if (!["admin", "editor"].includes(user.role)) {
    return NextResponse.json(
      { error: "当前账号没有权限执行这项操作。" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体不是有效的 JSON。" },
      { status: 400 }
    );
  }

  const parsed = aiDraftMetadataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "文章草稿无效" },
      { status: 400 }
    );
  }

  try {
    const metadata = await generateDraftMetadata(parsed.data);
    return NextResponse.json(metadata);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("timed out")
            ? "Slug 和 SEO 生成超时。可以稍后重试。"
            : "Slug 和 SEO 自动生成失败。请检查 AI 设置后重试。"
      },
      { status: 500 }
    );
  }
}
