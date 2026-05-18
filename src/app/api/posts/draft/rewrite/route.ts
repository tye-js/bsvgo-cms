import { NextResponse } from "next/server";

import { aiDraftRewriteSchema } from "@/lib/validators";
import { generateChineseDraft } from "@/server/ai/openai";
import {
  SourceIngestionError,
  fetchAiDraftSource
} from "@/server/ai/source-ingestion";
import { requireRole } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireRole(["admin", "editor"]);

  const parsed = aiDraftRewriteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "文章素材无效" },
      { status: 400 }
    );
  }

  try {
    const source = await fetchAiDraftSource(parsed.data.sourceUrl?.trim() ?? "");
    const draft = await generateChineseDraft({
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
      { status: 400 }
    );
  }
}
