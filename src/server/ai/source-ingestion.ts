import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type AiDraftSource = {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceContent?: string;
};

type CaptionTrack = {
  url: string;
  language: string;
  label: string;
  isAuto: boolean;
  isDefault: boolean;
  source: "html" | "youtube";
};

const MAX_REDIRECTS = 3;
const SOURCE_FETCH_TIMEOUT_MS = 12000;

export class SourceIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceIngestionError";
  }
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

function metaContent(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]).trim();
    }
  }
  return "";
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

function ipv4ToNumber(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function ipv4InCidr(address: string, base: string, bits: number) {
  const addressNumber = ipv4ToNumber(address);
  const baseNumber = ipv4ToNumber(base);
  if (addressNumber === null || baseNumber === null) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (addressNumber & mask) === (baseNumber & mask);
}

function isBlockedIpv4(address: string) {
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ].some(([base, bits]) => ipv4InCidr(address, String(base), Number(bits)));
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (/^f[cd][0-9a-f]*:/i.test(normalized)) return true;
  if (/^fe[89ab][0-9a-f]*:/i.test(normalized)) return true;
  if (/^ff[0-9a-f]*:/i.test(normalized)) return true;
  if (normalized.startsWith("2001:db8:")) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isBlockedIpv4(mapped[1]) : false;
}

function isBlockedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

function assertSafeHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost")) {
    throw new SourceIngestionError("不支持抓取本机或内网地址，请换一个公开链接或粘贴正文素材。");
  }
}

async function assertSafeUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SourceIngestionError("链接必须以 http:// 或 https:// 开头。");
  }
  if (url.username || url.password) {
    throw new SourceIngestionError("链接不能包含用户名或密码。");
  }

  assertSafeHostname(url.hostname);

  if (isIP(url.hostname)) {
    if (isBlockedAddress(url.hostname)) {
      throw new SourceIngestionError("不支持抓取本机或内网地址，请换一个公开链接或粘贴正文素材。");
    }
    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedAddress(item.address))) {
    throw new SourceIngestionError("不支持抓取本机或内网地址，请换一个公开链接或粘贴正文素材。");
  }
}

async function safeFetch(
  sourceUrl: string,
  signal: AbortSignal,
  redirectCount = 0
): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new SourceIngestionError("链接重定向次数过多，请换一个链接或粘贴正文素材。");
  }

  const url = new URL(sourceUrl);
  await assertSafeUrl(url);

  const response = await fetch(url, {
    signal,
    redirect: "manual",
    headers: {
      "User-Agent": "BSVgo CMS AI Writer/1.0"
    }
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) {
      throw new SourceIngestionError("链接重定向无效，请换一个链接或粘贴正文素材。");
    }
    return safeFetch(new URL(location, url).toString(), signal, redirectCount + 1);
  }

  return response;
}

async function fetchCaptionText(track: CaptionTrack, signal: AbortSignal) {
  for (const url of captionUrlCandidates(track)) {
    const response = await safeFetch(url, signal).catch(() => null);
    if (!response?.ok) continue;

    const text = parseCaptionText(await response.text())
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.slice(0, 20000);
  }

  return "";
}

export async function fetchAiDraftSource(sourceUrl: string): Promise<AiDraftSource> {
  const trimmedSourceUrl = sourceUrl.trim();
  if (!trimmedSourceUrl) return {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);

  try {
    const response = await safeFetch(trimmedSourceUrl, controller.signal);
    if (!response.ok) {
      throw new SourceIngestionError("链接读取失败，请换一个链接或粘贴正文素材。");
    }

    const finalUrl = response.url || trimmedSourceUrl;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return {
        sourceUrl: finalUrl,
        sourceTitle: finalUrl,
        sourceDescription: `链接内容类型：${contentType || "未知"}`
      };
    }

    const html = (await response.text()).slice(0, 800000);
    const sourceTitle =
      metaContent(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i
      ]) || finalUrl;
    const sourceDescription = metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
    ]);
    const track = selectCaptionTrack([
      ...extractYouTubeCaptionTracks(html),
      ...extractHtmlCaptionTracks(html, finalUrl)
    ]);
    const captionText = track ? await fetchCaptionText(track, controller.signal) : "";
    const readableText = extractReadableText(html);
    const captionLabel = track
      ? `${track.label || track.language || "默认字幕"}${track.isAuto ? "（自动字幕）" : ""}`
      : "";

    return {
      sourceUrl: finalUrl,
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
