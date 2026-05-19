import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";

export async function requireAnalyticsAccess() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "登录状态已失效，请重新登录后再试。" },
      { status: 401 }
    );
  }

  if (!["admin", "editor"].includes(user.role)) {
    return NextResponse.json(
      { error: "当前账号没有权限查看统计数据。" },
      { status: 403 }
    );
  }

  return null;
}
