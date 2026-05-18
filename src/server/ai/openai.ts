import "server-only";

import { getAiSettingsForGeneration } from "@/server/settings/service";

type EnglishPostInput = {
  title: string;
  excerpt?: string;
  content: string;
};

type EnglishPostOutput = {
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
};

type ChineseDraftInput = {
  rawInput?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceContent?: string;
};

export type ChineseDraftOutput = {
  slug: string;
  zh: {
    title: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
  };
  en: {
    title: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
  };
};

export type SeoTargetType = "homepage" | "category" | "tag" | "post";

type SeoSuggestionInput = {
  targetType: SeoTargetType;
  enTitle?: string;
  enDescription?: string;
  enContent?: string;
  zhTitle?: string;
  zhDescription?: string;
  zhContent?: string;
  keywords?: string;
};

type ResponsesJsonSchema = {
  type: "object";
  additionalProperties: false;
  properties: Record<string, unknown>;
  required: string[];
};

type ResponsesTextFormat = {
  type: "json_schema";
  name: string;
  strict: true;
  schema: ResponsesJsonSchema;
};

type ResponsesInput = Array<{
  role: "system" | "user";
  content: Array<{
    type: "input_text";
    text: string;
  }>;
}>;

type AiGenerationSettings = Awaited<ReturnType<typeof getAiSettingsForGeneration>>;

export type LocalizedSeoSuggestion = {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
};

export type SeoSuggestionOutput = {
  en: LocalizedSeoSuggestion;
  zh: LocalizedSeoSuggestion;
};

function responsesUrl(apiBaseUrl: string) {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function providerLabel(apiBaseUrl: string) {
  return apiBaseUrl.includes("api.openai.com") ? "OpenAI" : "AI provider";
}

function outputText(payload: unknown) {
  const response = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text;
}

function clean(value: unknown, maxLength?: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return maxLength ? text.slice(0, maxLength) : text;
}

function parseEnglishPost(payload: unknown): EnglishPostOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return generated English content.");
  }

  const parsed = JSON.parse(text) as Partial<EnglishPostOutput>;
  const output = {
    title: clean(parsed.title, 255),
    excerpt: clean(parsed.excerpt),
    content: clean(parsed.content),
    seoTitle: clean(parsed.seoTitle, 255),
    seoDescription: clean(parsed.seoDescription, 500)
  };

  if (!output.title || !output.content) {
    throw new Error("AI provider returned incomplete English content.");
  }

  return output;
}

function parseChineseDraft(payload: unknown): ChineseDraftOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return generated Chinese draft.");
  }

  const parsed = JSON.parse(text) as Partial<ChineseDraftOutput>;
  const output = {
    slug: clean(parsed.slug, 180)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-"),
    zh: {
      title: clean(parsed.zh?.title, 255),
      excerpt: clean(parsed.zh?.excerpt, 500),
      content: clean(parsed.zh?.content),
      seoTitle: clean(parsed.zh?.seoTitle, 255),
      seoDescription: clean(parsed.zh?.seoDescription, 500)
    },
    en: {
      title: clean(parsed.en?.title, 255),
      excerpt: clean(parsed.en?.excerpt, 500),
      content: clean(parsed.en?.content),
      seoTitle: clean(parsed.en?.seoTitle, 255),
      seoDescription: clean(parsed.en?.seoDescription, 500)
    }
  };

  if (!output.zh.title || !output.zh.content || !output.en.title || !output.en.content) {
    throw new Error("AI provider returned incomplete bilingual draft.");
  }

  return {
    ...output,
    slug: output.slug || "draft-post"
  };
}

function parseSeoSuggestion(payload: unknown): SeoSuggestionOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return SEO suggestions.");
  }

  const parsed = JSON.parse(text) as Partial<SeoSuggestionOutput>;
  const output = {
    en: {
      title: clean(parsed.en?.title, 255),
      description: clean(parsed.en?.description, 500),
      keywords: clean(parsed.en?.keywords, 500),
      ogTitle: clean(parsed.en?.ogTitle, 255),
      ogDescription: clean(parsed.en?.ogDescription, 500)
    },
    zh: {
      title: clean(parsed.zh?.title, 255),
      description: clean(parsed.zh?.description, 500),
      keywords: clean(parsed.zh?.keywords, 500),
      ogTitle: clean(parsed.zh?.ogTitle, 255),
      ogDescription: clean(parsed.zh?.ogDescription, 500)
    }
  };

  if (
    !output.en.title ||
    !output.en.description ||
    !output.zh.title ||
    !output.zh.description
  ) {
    throw new Error("AI provider returned incomplete bilingual SEO suggestions.");
  }

  return output;
}

const localizedSeoSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "SEO title for this locale, ideally concise and search-friendly."
    },
    description: {
      type: "string",
      description: "Meta description for this locale, ideally 120-160 characters."
    },
    keywords: {
      type: "string",
      description: "Comma-separated SEO keywords in this locale."
    },
    ogTitle: {
      type: "string",
      description: "Open Graph title for social previews in this locale."
    },
    ogDescription: {
      type: "string",
      description: "Open Graph description for social previews in this locale."
    }
  },
  required: ["title", "description", "keywords", "ogTitle", "ogDescription"]
} as const;

async function callResponsesJson({
  settings,
  input,
  format,
  timeoutMessage
}: {
  settings?: AiGenerationSettings;
  input: ResponsesInput;
  format: ResponsesTextFormat;
  timeoutMessage: string;
}) {
  const { apiKey, apiBaseUrl, model, timeoutMs } =
    settings ?? (await getAiSettingsForGeneration());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(responsesUrl(apiBaseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input,
        text: {
          format
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${providerLabel(apiBaseUrl)} request failed: ${response.status} ${errorText}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${providerLabel(apiBaseUrl)} ${timeoutMessage}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateEnglishPost(
  input: EnglishPostInput
): Promise<EnglishPostOutput> {
  const payload = await callResponsesJson({
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS English editor. Translate and adapt Chinese blog drafts into polished English Markdown for a technical audience. Preserve factual meaning, headings, links, code blocks, lists, quotes, and Markdown structure. Do not add unsupported facts."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Generate the English version of this BSVgo blog post.",
              sourceLanguage: "zh",
              targetLanguage: "en",
              title: input.title,
              excerpt: input.excerpt ?? "",
              content: input.content
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "english_blog_post",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "English article title, concise and publication-ready."
          },
          excerpt: {
            type: "string",
            description: "English summary for list pages."
          },
          content: {
            type: "string",
            description: "English article body in Markdown."
          },
          seoTitle: {
            type: "string",
            description: "English SEO title, under 60 characters when possible."
          },
          seoDescription: {
            type: "string",
            description: "English SEO description, under 160 characters when possible."
          }
        },
        required: ["title", "excerpt", "content", "seoTitle", "seoDescription"]
      }
    },
    timeoutMessage: "generation timed out. Please try again."
  });

  return parseEnglishPost(payload);
}

export async function generateChineseDraft(
  input: ChineseDraftInput
): Promise<ChineseDraftOutput> {
  const settings = await getAiSettingsForGeneration();
  const payload = await callResponsesJson({
    settings,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS bilingual editor. Turn rough notes, links, fragments, transcripts, or unstructured source material into polished Simplified Chinese and English blog drafts in Markdown. Follow the configured writing style, preserve facts and technical details, organize messy material into coherent articles, and do not invent unsupported claims. Chinese and English should be equivalent articles, not summaries of each other."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Rewrite unstructured material into bilingual blog drafts.",
              writingStyle: settings.writingStyle,
              rawInput: input.rawInput ?? "",
              source: {
                url: input.sourceUrl ?? "",
                title: input.sourceTitle ?? "",
                description: input.sourceDescription ?? "",
                content: input.sourceContent ?? ""
              }
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "chinese_blog_draft",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: {
            type: "string",
            description:
              "Lowercase English URL slug using only letters, numbers, and hyphens."
          },
          zh: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                description: "Simplified Chinese article title."
              },
              excerpt: {
                type: "string",
                description: "Simplified Chinese article summary for list pages."
              },
              content: {
                type: "string",
                description: "Simplified Chinese article body in Markdown."
              },
              seoTitle: {
                type: "string",
                description: "Simplified Chinese SEO title."
              },
              seoDescription: {
                type: "string",
                description: "Simplified Chinese SEO description."
              }
            },
            required: [
              "title",
              "excerpt",
              "content",
              "seoTitle",
              "seoDescription"
            ]
          },
          en: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                description: "English article title."
              },
              excerpt: {
                type: "string",
                description: "English article summary for list pages."
              },
              content: {
                type: "string",
                description: "English article body in Markdown."
              },
              seoTitle: {
                type: "string",
                description: "English SEO title."
              },
              seoDescription: {
                type: "string",
                description: "English SEO description."
              }
            },
            required: ["title", "excerpt", "content", "seoTitle", "seoDescription"]
          }
        },
        required: ["slug", "zh", "en"]
      }
    },
    timeoutMessage: "draft generation timed out."
  });

  return parseChineseDraft(payload);
}

export async function generateSeoSuggestion(
  input: SeoSuggestionInput
): Promise<SeoSuggestionOutput> {
  const payload = await callResponsesJson({
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS bilingual SEO editor. Generate concise, search-friendly SEO metadata for both English and Simplified Chinese pages. Keep each locale natural for native readers, preserve technical accuracy, and do not add facts unsupported by the source content. English SEO is for the English frontend page; Chinese SEO is for the Chinese frontend page."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Generate SEO metadata.",
              targetType: input.targetType,
              english: {
                title: input.enTitle ?? "",
                description: input.enDescription ?? "",
                content: input.enContent ?? ""
              },
              chinese: {
                title: input.zhTitle ?? "",
                description: input.zhDescription ?? "",
                content: input.zhContent ?? ""
              },
              keywords: input.keywords ?? ""
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "seo_metadata",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          en: localizedSeoSchema,
          zh: localizedSeoSchema
        },
        required: ["en", "zh"]
      }
    },
    timeoutMessage: "SEO generation timed out."
  });

  return parseSeoSuggestion(payload);
}
