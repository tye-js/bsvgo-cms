import { NextResponse } from "next/server";

import { requireAnalyticsAccess } from "@/server/analytics/access";
import {
  AnalyticsQueryError,
  getAnalyticsEvents,
  parseAnalyticsFilters
} from "@/server/analytics/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAnalyticsAccess();
  if (authError) return authError;

  try {
    const filters = parseAnalyticsFilters(new URL(request.url).searchParams, {
      defaultLimit: 50,
      includeEventName: true
    });
    const events = await getAnalyticsEvents(filters);
    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof AnalyticsQueryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "读取事件明细失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
