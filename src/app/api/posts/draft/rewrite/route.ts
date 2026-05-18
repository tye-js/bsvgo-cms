import { NextResponse } from "next/server";

import { aiDraftRewriteSchema } from "@/lib/validators";
import { generateChineseDraft } from "@/server/ai/openai";
import { requireRole } from "@/server/auth/session";

export const runtime = "nodejs";

type CaptionTrack = {
  url: string;
  language: string;
  label: string;
  isAuto: boolean;
  isDefault: boolean;
  source: "html" | "youtube";
};

function metaContent(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]).trim();
    }
  }
  return "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function extractReadableText(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, 12000);
}

function attributeValue(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?`, "i")
  );
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "true") : "";
}

function textFromYouTubeRuns(value: unknown) {
  const name = value as {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };
  return name.simpleText ?? name.runs?.map((run) => run.text ?? "").join("") ?? "";
}

function extractJsonObjectAfter(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return "";

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }

  return "";
}

function extractHtmlCaptionTracks(html: string, pageUrl: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];

  for (const match of html.matchAll(/<track\b[^>]*>/gi)) {
    const tag = match[0];
    const kind = attributeValue(tag, "kind").toLowerCase();
    const src = attributeValue(tag, "src");
    if (!src || (kind && !["captions", "subtitles"].includes(kind))) continue;

    tracks.push({
      url: new URL(src, pageUrl).toString(),
      language: attributeValue(tag, "srclang") || attributeValue(tag, "lang"),
      label: attributeValue(tag, "label"),
      isAuto: false,
      isDefault: /\sdefault(?:\s|=|>)/i.test(tag),
      source: "html"
    });
  }

  return tracks;
}

function extractYouTubeCaptionTracks(html: string): CaptionTrack[] {
  const jsonText = extractJsonObjectAfter(html, "ytInitialPlayerResponse");
  if (!jsonText) return [];

  try {
    const player = JSON.parse(jsonText) as {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{
            baseUrl?: string;
            languageCode?: string;
            kind?: string;
            isDefault?: boolean;
            name?: unknown;
          }>;
        };
      };
    };
    const tracks =
      player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    return tracks
      .filter((track) => track.baseUrl)
      .map((track) => ({
        url: track.baseUrl ?? "",
        language: track.languageCode ?? "",
        label: textFromYouTubeRuns(track.name),
        isAuto: track.kind === "asr",
        isDefault: Boolean(track.isDefault),
        source: "youtube" as const
      }));
  } catch {
    return [];
  }
}

function selectCaptionTrack(tracks: CaptionTrack[]) {
  const score = (track: CaptionTrack) => {
    const isEnglish = /^en(?:[-_]|$)/i.test(track.language);
    if (isEnglish && !track.isAuto) return 0;
    if (isEnglish) return 1;
    if (track.isDefault && !track.isAuto) return 2;
    if (!track.isAuto) return 3;
    if (track.isDefault) return 4;
    return 5;
  };

  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}

function captionUrlCandidates(track: CaptionTrack) {
  if (track.source !== "youtube") return [track.url];

  const url = new URL(track.url);
  url.searchParams.set("fmt", "json3");
  return [url.toString(), track.url];
}

function parseCaptionText(payload: string) {
  const trimmed = payload.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        events?: Array<{ segs?: Array<{ utf8?: string }> }>;
      };
      return (
        parsed.events
          ?.flatMap((event) => event.segs ?? [])
          .map((segment) => segment.utf8 ?? "")
          .join(" ") ?? ""
      );
    } catch {
      return "";
    }
  }

  return decodeHtml(
    trimmed
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => {
        const value = line.trim();
        return (
          value &&
          !/^WEBVTT/i.test(value) &&
          !/^NOTE\b/i.test(value) &&
          !/^STYLE\b/i.test(value) &&
          !/^\d+$/.test(value) &&
          !/-->/i.test(value)
        );
      })
      .join(" ")
      .replace(/<[^>]+>/g, " ")
  );
}

async function fetchCaptionText(track: CaptionTrack, signal: AbortSignal) {
  for (const url of captionUrlCandidates(track)) {
    const response = await fetch(url, {
      signal,
      headers: {
        "User-Agent": "BSVgo CMS AI Writer/1.0"
      }
    }).catch(() => null);

    if (!response?.ok) continue;

    const text = parseCaptionText(await response.text())
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.slice(0, 20000);
  }

  return "";
}

async function fetchSourcePage(sourceUrl: string) {
  if (!sourceUrl) return {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BSVgo CMS AI Writer/1.0"
      }
    });

    if (!response.ok) {
      throw new Error("source request failed");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return {
        sourceUrl,
        sourceTitle: sourceUrl,
        sourceDescription: `链接内容类型：${contentType || "未知"}`
      };
    }

    const html = (await response.text()).slice(0, 800000);
    const sourceTitle =
      metaContent(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i
      ]) || sourceUrl;
    const sourceDescription = metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
    ]);
    const track = selectCaptionTrack([
      ...extractYouTubeCaptionTracks(html),
      ...extractHtmlCaptionTracks(html, sourceUrl)
    ]);
    const captionText = track ? await fetchCaptionText(track, controller.signal) : "";
    const readableText = extractReadableText(html);
    const captionLabel = track
      ? `${track.label || track.language || "默认字幕"}${track.isAuto ? "（自动字幕）" : ""}`
      : "";

    return {
      sourceUrl,
      sourceTitle,
      sourceDescription: captionLabel
        ? `${sourceDescription}\n已抓取字幕：${captionLabel}`.trim()
        : sourceDescription,
      sourceContent: captionText
        ? `视频字幕（优先用于写作）：\n${captionText}\n\n网页可见文本：\n${readableText}`
        : readableText
    };
  } finally {
    clearTimeout(timer);
  }
}

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
    const source = await fetchSourcePage(parsed.data.sourceUrl?.trim() ?? "");
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

    return NextResponse.json(
      { error: "AI 改写文章失败。请检查 AI 设置后重试。" },
      { status: 400 }
    );
  }
}
