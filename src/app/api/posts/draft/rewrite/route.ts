import { NextResponse } from "next/server";

import { aiDraftRewriteSchema } from "@/lib/validators";
import { generateChineseDraft } from "@/server/ai/openai";
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
    const draft = await generateChineseDraft(parsed.data);
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json(
      { error: "AI 改写文章失败。请检查 AI 设置后重试。" },
      { status: 400 }
    );
  }
}
