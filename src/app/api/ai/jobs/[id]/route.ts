import { NextResponse } from "next/server";

import { getAiJobForUser, retryAiJobForUser } from "@/server/ai/jobs";
import { getCurrentUser } from "@/server/auth/session";

export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentContentUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "登录状态已失效，请重新登录后再试。" },
        { status: 401 }
      )
    };
  }

  if (!["admin", "editor"].includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "当前账号没有权限执行这项操作。" },
        { status: 403 }
      )
    };
  }

  return { user, response: null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "AI 任务不存在。" }, { status: 404 });
  }

  const { user, response } = await currentContentUser();
  if (!user) return response;

  const job = await getAiJobForUser(id, user);
  if (!job) {
    return NextResponse.json({ error: "AI 任务不存在。" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "AI 任务不存在。" }, { status: 404 });
  }

  const { user, response } = await currentContentUser();
  if (!user) return response;

  const job = await retryAiJobForUser(id, user);
  if (!job) {
    return NextResponse.json(
      { error: "只能重试失败的 AI 任务。" },
      { status: 400 }
    );
  }

  return NextResponse.json({ job });
}
