import { NextResponse } from "next/server";

import { aiDraftCreateSchema } from "@/lib/validators";
import { createAiJob } from "@/server/ai/jobs";
import { getCurrentUser } from "@/server/auth/session";

export const runtime = "nodejs";

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

  const parsed = aiDraftCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "文章素材无效" },
      { status: 400 }
    );
  }

  const job = await createAiJob({
    type: "post_draft_create",
    input: parsed.data,
    userId: user.id
  });

  return NextResponse.json({ job });
}
