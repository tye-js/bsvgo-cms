import { NextResponse } from "next/server";

import { seoSuggestionSchema } from "@/lib/validators";
import { generateSeoSuggestion } from "@/server/ai/openai";
import { requireRole } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireRole(["admin", "editor"]);

  const parsed = seoSuggestionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "SEO 建议请求无效" },
      { status: 400 }
    );
  }

  try {
    const suggestion = await generateSeoSuggestion(parsed.data);
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json(
      { error: "AI 生成 SEO 建议失败。请检查 AI 设置后重试。" },
      { status: 400 }
    );
  }
}
