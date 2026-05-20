import { NextResponse } from "next/server";

import { aiDraftRewriteSchema } from "@/lib/validators";
import { generateChineseDraftCore } from "@/server/ai/openai";
import {
  SourceIngestionError,
  fetchAiDraftSource
} from "@/server/ai/source-ingestion";
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

  const parsed = aiDraftRewriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "文章素材无效" },
      { status: 400 }
    );
  }

  try {
    const source = await fetchAiDraftSource(parsed.data.sourceUrl?.trim() ?? "");
    const draft = await generateChineseDraftCore({
      writingRole: parsed.data.writingRole,
      rawInput: parsed.data.rawInput,
      ...source
    });
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "链接读取超时。可以把网页关键信息粘贴到素材框后重试。" },
        { status: 400 }
      );
    }

    if (error instanceof SourceIngestionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "AI 改写文章失败。请检查 AI 设置后重试。" },
      { status: 500 }
    );
  }
}
