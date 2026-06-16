import "server-only";

import type { AiWritingRoleId } from "@/lib/ai-style";
import {
  getAiSettingsForGeneration,
  getImageGenerationSettings
} from "@/server/settings/service";

type EnglishPostInput = {
  writingRole?: AiWritingRoleId;
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
  writingRole?: AiWritingRoleId;
  rawInput?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceContent?: string;
};

export type ChineseDraftCoreInput = ChineseDraftInput;

export type DraftTranslationInput = {
  writingRole?: AiWritingRoleId;
  zhTitle: string;
  zhExcerpt?: string;
  zhContent: string;
};

export type DraftMetadataInput = {
  writingRole?: AiWritingRoleId;
  zhTitle: string;
  zhExcerpt?: string;
  zhContent: string;
  enTitle: string;
  enExcerpt?: string;
  enContent: string;
};

type LocalizedStructuredSeo = {
  seoTitle: string;
  seoDescription: string;
  structuredData: Record<string, unknown>;
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

export type ChineseDraftCoreOutput = {
  zh: {
    title: string;
    excerpt: string;
    content: string;
  };
};

export type DraftTranslationOutput = {
  en: {
    title: string;
    excerpt: string;
    content: string;
  };
};

export type DraftMetadataOutput = {
  slug: string;
  zh: LocalizedStructuredSeo;
  en: LocalizedStructuredSeo;
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

type MediaMetadataInput = {
  url: string;
  originalFilename?: string | null;
  width?: number | null;
  height?: number | null;
  currentAltText?: string;
  currentCaption?: string;
  currentZhAltText?: string;
  currentEnAltText?: string;
  currentZhSeoTitle?: string;
  currentZhSeoDescription?: string;
  currentEnSeoTitle?: string;
  currentEnSeoDescription?: string;
};

export type CoverImageCategory = "blockchain" | "ai" | "infrastructure";

export type CoverImageGenerationInput = {
  title: string;
  description?: string;
  category: CoverImageCategory;
  categoryName: string;
};

export type MediaMetadataOutput = {
  zhAltText: string;
  enAltText: string;
  zhSeoTitle: string;
  zhSeoDescription: string;
  enSeoTitle: string;
  enSeoDescription: string;
  caption: string;
  seoSummary: string;
};

export type GeneratedCoverImage = {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
  model: string;
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

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type AiGenerationSettings = Awaited<ReturnType<typeof getAiSettingsForGeneration>>;

function stylePayload(settings: AiGenerationSettings) {
  return {
    baseStyle: settings.writingStyle,
    role: {
      id: settings.writingRole.id,
      label: settings.writingRole.label,
      instructions: settings.writingRoleStyle
    }
  };
}

function seoStylePayload(settings: AiGenerationSettings) {
  return {
    zh: settings.zhSeoStyle,
    en: settings.enSeoStyle
  };
}

export type LocalizedSeoSuggestion = {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  structuredData: Record<string, unknown>;
};

export type SeoSuggestionOutput = {
  en: LocalizedSeoSuggestion;
  zh: LocalizedSeoSuggestion;
};

function responsesUrl(apiBaseUrl: string) {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function chatCompletionsUrl(apiBaseUrl: string) {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function imageGenerationsUrl(apiBaseUrl: string) {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/images/generations")) return normalized;
  return normalized.endsWith("/v1")
    ? `${normalized}/images/generations`
    : `${normalized}/v1/images/generations`;
}

function isResponsesProvider(apiBaseUrl: string) {
  return apiBaseUrl.includes("api.openai.com") || apiBaseUrl.endsWith("/responses");
}

function providerLabel(apiBaseUrl: string) {
  if (apiBaseUrl.includes("deepseek.com")) return "DeepSeek";
  return apiBaseUrl.includes("api.openai.com") ? "OpenAI" : "AI provider";
}

function isDeepSeekProvider(apiBaseUrl: string) {
  return apiBaseUrl.toLowerCase().includes("deepseek.com");
}

function isDeepSeekV4Model(model: string) {
  return model.trim().toLowerCase().startsWith("deepseek-v4");
}

function deepSeekChatOptions(apiBaseUrl: string, model: string) {
  if (!isDeepSeekProvider(apiBaseUrl) || !isDeepSeekV4Model(model)) {
    return {};
  }

  return {
    thinking: { type: "disabled" }
  };
}

function imageMimeType(outputFormat: string) {
  if (outputFormat === "jpeg") return "image/jpeg";
  if (outputFormat === "webp") return "image/webp";
  return "image/png";
}

function buildCoverImagePrompt(
  input: CoverImageGenerationInput,
  promptStyle: string
) {
  return [
    promptStyle,
    "",
    "Create one original blog cover image customized for this exact article.",
    "Do not include readable text, logos, watermarks, UI screenshots, price charts, or celebrity/person likenesses.",
    "Keep the result suitable for a professional technical publication.",
    "",
    `Article title: ${input.title}`,
    input.description ? `Article description: ${input.description}` : "",
    `Major category: ${input.categoryName} (${input.category})`,
    "Use the title, description, and major category to decide the scene, symbols, materials, and visual mood."
  ]
    .filter(Boolean)
    .join("\n");
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

function chatOutputText(payload: unknown) {
  const response = payload as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return response.choices?.[0]?.message?.content;
}

function clean(value: unknown, maxLength?: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return maxLength ? text.slice(0, maxLength) : text;
}

function cleanStructuredData(value: unknown, fallback: Record<string, unknown>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value as Record<string, unknown>;
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

function parseChineseDraftCore(payload: unknown): ChineseDraftCoreOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return generated Chinese draft.");
  }

  const parsed = JSON.parse(text) as Partial<ChineseDraftCoreOutput>;
  const output = {
    zh: {
      title: clean(parsed.zh?.title, 255),
      excerpt: clean(parsed.zh?.excerpt, 500),
      content: clean(parsed.zh?.content)
    }
  };

  if (!output.zh.title || !output.zh.content) {
    throw new Error("AI provider returned incomplete Chinese draft.");
  }

  return output;
}

function parseDraftTranslation(payload: unknown): DraftTranslationOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return translated English content.");
  }

  const parsed = JSON.parse(text) as Partial<DraftTranslationOutput>;
  const output = {
    en: {
      title: clean(parsed.en?.title, 255),
      excerpt: clean(parsed.en?.excerpt, 500),
      content: clean(parsed.en?.content)
    }
  };

  if (!output.en.title || !output.en.content) {
    throw new Error("AI provider returned incomplete translated English content.");
  }

  return output;
}

function parseDraftMetadata(payload: unknown): DraftMetadataOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return draft metadata.");
  }

  const parsed = JSON.parse(text) as Partial<DraftMetadataOutput>;
  const output = {
    slug: clean(parsed.slug, 180)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-"),
    zh: {
      seoTitle: clean(parsed.zh?.seoTitle, 255),
      seoDescription: clean(parsed.zh?.seoDescription, 500),
      structuredData: cleanStructuredData(parsed.zh?.structuredData, {})
    },
    en: {
      seoTitle: clean(parsed.en?.seoTitle, 255),
      seoDescription: clean(parsed.en?.seoDescription, 500),
      structuredData: cleanStructuredData(parsed.en?.structuredData, {})
    }
  };

  if (!output.slug) {
    throw new Error("AI provider returned an invalid slug.");
  }

  if (
    !output.zh.seoTitle ||
    !output.zh.seoDescription ||
    !output.en.seoTitle ||
    !output.en.seoDescription
  ) {
    throw new Error("AI provider returned incomplete draft metadata.");
  }

  return output;
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
      ogDescription: clean(parsed.en?.ogDescription, 500),
      structuredData: cleanStructuredData(parsed.en?.structuredData, {})
    },
    zh: {
      title: clean(parsed.zh?.title, 255),
      description: clean(parsed.zh?.description, 500),
      keywords: clean(parsed.zh?.keywords, 500),
      ogTitle: clean(parsed.zh?.ogTitle, 255),
      ogDescription: clean(parsed.zh?.ogDescription, 500),
      structuredData: cleanStructuredData(parsed.zh?.structuredData, {})
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

function parseMediaMetadata(payload: unknown): MediaMetadataOutput {
  const text = outputText(payload);
  if (!text) {
    throw new Error("AI provider did not return media metadata.");
  }

  const parsed = JSON.parse(text) as Partial<MediaMetadataOutput>;
  return {
    zhAltText: clean(parsed.zhAltText, 255),
    enAltText: clean(parsed.enAltText, 255),
    zhSeoTitle: clean(parsed.zhSeoTitle, 255),
    zhSeoDescription: clean(parsed.zhSeoDescription, 500),
    enSeoTitle: clean(parsed.enSeoTitle, 255),
    enSeoDescription: clean(parsed.enSeoDescription, 500),
    caption: clean(parsed.caption, 500),
    seoSummary: clean(
      parsed.seoSummary || parsed.zhSeoDescription || parsed.enSeoDescription,
      500
    )
  };
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
    },
    structuredData: {
      type: "object",
      additionalProperties: true,
      description:
        "JSON-LD Article or BlogPosting structured data object for this locale. Include @context, @type, headline, description, inLanguage, and keywords when possible. Do not include unsupported facts."
    }
  },
  required: [
    "title",
    "description",
    "keywords",
    "ogTitle",
    "ogDescription",
    "structuredData"
  ]
} as const;

function inputToChatMessages(input: ResponsesInput): ChatMessage[] {
  return input.map((item) => ({
    role: item.role,
    content: item.content
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
  }));
}

function schemaInstruction(format: ResponsesTextFormat) {
  return [
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    "The JSON must satisfy this schema:",
    JSON.stringify(format.schema)
  ].join("\n");
}

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
  const provider = isResponsesProvider(apiBaseUrl) ? "responses" : "chat";

  try {
    const response = await fetch(
      provider === "responses"
        ? responsesUrl(apiBaseUrl)
        : chatCompletionsUrl(apiBaseUrl),
      {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body:
        provider === "responses"
          ? JSON.stringify({
              model,
              input,
              text: {
                format
              }
            })
          : JSON.stringify({
              model,
              ...deepSeekChatOptions(apiBaseUrl, model),
              messages: [
                ...inputToChatMessages(input),
                {
                  role: "system",
                  content: schemaInstruction(format)
                }
              ],
              response_format: { type: "json_object" }
            })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${providerLabel(apiBaseUrl)} request failed: ${response.status} ${errorText}`
      );
    }

    const payload = await response.json();
    if (provider === "responses") return payload;

    return {
      output_text: chatOutputText(payload)
    };
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
  const settings = await getAiSettingsForGeneration(input.writingRole);
  const payload = await callResponsesJson({
    settings,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS English editor. Translate and adapt Chinese blog drafts into polished English Markdown for a technical audience. Follow the configured writing role and English SEO style. Preserve factual meaning, headings, links, code blocks, lists, quotes, and Markdown structure. Do not add unsupported facts."
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
              writingStyle: stylePayload(settings),
              seoStyle: {
                en: settings.enSeoStyle
              },
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
  const settings = await getAiSettingsForGeneration(input.writingRole);
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
              writingStyle: stylePayload(settings),
              seoStyle: seoStylePayload(settings),
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

export async function generateChineseDraftCore(
  input: ChineseDraftCoreInput
): Promise<ChineseDraftCoreOutput> {
  const settings = await getAiSettingsForGeneration(input.writingRole);
  const payload = await callResponsesJson({
    settings,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS Chinese editor. Turn rough notes, links, fragments, transcripts, or unstructured source material into a polished Simplified Chinese blog draft in Markdown. Follow the configured writing style, preserve facts and technical details, organize messy material into coherent articles, and do not invent unsupported claims. Return only Chinese title, excerpt, and content."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Rewrite unstructured material into a Chinese blog draft.",
              writingStyle: stylePayload(settings),
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
      name: "chinese_blog_draft_core",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
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
              }
            },
            required: ["title", "excerpt", "content"]
          }
        },
        required: ["zh"]
      }
    },
    timeoutMessage: "draft generation timed out."
  });

  return parseChineseDraftCore(payload);
}

export async function translateDraftToEnglish(
  input: DraftTranslationInput
): Promise<DraftTranslationOutput> {
  const settings = await getAiSettingsForGeneration(input.writingRole);
  const payload = await callResponsesJson({
    settings,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS English editor. Translate and adapt the provided Simplified Chinese draft into polished English Markdown. Preserve factual meaning, headings, links, code blocks, lists, and tone. Follow the configured writing role, but do not add unsupported facts."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Translate the Chinese draft into English.",
              writingStyle: stylePayload(settings),
              chinese: {
                title: input.zhTitle,
                excerpt: input.zhExcerpt ?? "",
                content: input.zhContent
              }
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "draft_translation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
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
                description: "English article summary."
              },
              content: {
                type: "string",
                description: "English article body in Markdown."
              }
            },
            required: ["title", "excerpt", "content"]
          }
        },
        required: ["en"]
      }
    },
    timeoutMessage: "translation timed out."
  });

  return parseDraftTranslation(payload);
}

export async function generateDraftMetadata(
  input: DraftMetadataInput
): Promise<DraftMetadataOutput> {
  const settings = await getAiSettingsForGeneration(input.writingRole);
  const payload = await callResponsesJson({
    settings,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are the BSVgo CMS metadata editor. Generate a concise URL slug, SEO titles/descriptions, and JSON-LD structured data for both Simplified Chinese and English article pages. Keep them search-friendly, accurate, natural, and aligned with the configured locale-specific SEO styles. Structured data must be valid Article or BlogPosting JSON-LD and must not include unsupported facts."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Generate slug and bilingual SEO metadata.",
              writingStyle: stylePayload(settings),
              seoStyle: seoStylePayload(settings),
              chinese: {
                title: input.zhTitle,
                excerpt: input.zhExcerpt ?? "",
                content: input.zhContent
              },
              english: {
                title: input.enTitle,
                excerpt: input.enExcerpt ?? "",
                content: input.enContent
              }
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "draft_metadata",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: {
            type: "string",
            description: "Lowercase English URL slug using only letters, numbers, and hyphens."
          },
          zh: {
            type: "object",
            additionalProperties: false,
            properties: {
              seoTitle: {
                type: "string",
                description: "Simplified Chinese SEO title."
              },
              seoDescription: {
                type: "string",
                description: "Simplified Chinese SEO description."
              },
              structuredData: {
                type: "object",
                additionalProperties: true,
                description:
                  "JSON-LD BlogPosting object for the Simplified Chinese article. Include @context, @type, headline, description, inLanguage, and keywords when possible."
              }
            },
            required: ["seoTitle", "seoDescription", "structuredData"]
          },
          en: {
            type: "object",
            additionalProperties: false,
            properties: {
              seoTitle: {
                type: "string",
                description: "English SEO title."
              },
              seoDescription: {
                type: "string",
                description: "English SEO description."
              },
              structuredData: {
                type: "object",
                additionalProperties: true,
                description:
                  "JSON-LD BlogPosting object for the English article. Include @context, @type, headline, description, inLanguage, and keywords when possible."
              }
            },
            required: ["seoTitle", "seoDescription", "structuredData"]
          }
        },
        required: ["slug", "zh", "en"]
      }
    },
    timeoutMessage: "metadata generation timed out."
  });

  return parseDraftMetadata(payload);
}

export async function generateSeoSuggestion(
  input: SeoSuggestionInput
): Promise<SeoSuggestionOutput> {
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
              "You are the BSVgo CMS bilingual SEO editor. Generate concise, search-friendly SEO metadata for both English and Simplified Chinese pages. Follow the configured SEO style for each locale, keep each locale natural for native readers, preserve technical accuracy, and do not add facts unsupported by the source content. English SEO is for the English frontend page; Chinese SEO is for the Chinese frontend page."
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
              seoStyle: seoStylePayload(settings),
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

export async function generateMediaMetadata(
  input: MediaMetadataInput
): Promise<MediaMetadataOutput> {
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
              "You are the BSVgo CMS media metadata editor. Generate concise, factual bilingual image metadata for a technical blog CMS. Use only the URL, filename, dimensions, and existing metadata. Do not claim visual details that are not inferable. Chinese fields should be natural for Chinese readers; English fields should be natural, search-friendly English."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task:
                "Generate bilingual image alt text and SEO metadata. Keep fields factual, concise, and suitable for article cover discovery.",
              writingStyle: stylePayload(settings),
              image: {
                url: input.url,
                originalFilename: input.originalFilename ?? "",
                width: input.width ?? null,
                height: input.height ?? null,
                currentAltText: input.currentAltText ?? "",
                currentCaption: input.currentCaption ?? "",
                currentZhAltText: input.currentZhAltText ?? "",
                currentEnAltText: input.currentEnAltText ?? "",
                currentZhSeoTitle: input.currentZhSeoTitle ?? "",
                currentZhSeoDescription: input.currentZhSeoDescription ?? "",
                currentEnSeoTitle: input.currentEnSeoTitle ?? "",
                currentEnSeoDescription: input.currentEnSeoDescription ?? ""
              }
            })
          }
        ]
      }
    ],
    format: {
      type: "json_schema",
      name: "media_metadata",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          zhAltText: {
            type: "string",
            description: "Chinese image alt text, factual and under 125 Chinese characters."
          },
          enAltText: {
            type: "string",
            description: "English image alt text, factual and ideally under 125 characters."
          },
          zhSeoTitle: {
            type: "string",
            description: "Chinese SEO title for this media asset."
          },
          zhSeoDescription: {
            type: "string",
            description: "Chinese SEO description for this media asset."
          },
          enSeoTitle: {
            type: "string",
            description: "English SEO title for this media asset."
          },
          enSeoDescription: {
            type: "string",
            description: "English SEO description for this media asset."
          },
          caption: {
            type: "string",
            description: "Short Chinese image caption for the CMS media library."
          },
          seoSummary: {
            type: "string",
            description:
              "Concise Chinese summary for media discovery and article cover context."
          }
        },
        required: [
          "zhAltText",
          "enAltText",
          "zhSeoTitle",
          "zhSeoDescription",
          "enSeoTitle",
          "enSeoDescription",
          "caption",
          "seoSummary"
        ]
      }
    },
    timeoutMessage: "media metadata generation timed out."
  });

  return parseMediaMetadata(payload);
}

export async function generatePostCoverImage(
  input: CoverImageGenerationInput
): Promise<GeneratedCoverImage> {
  const settings = await getImageGenerationSettings();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const prompt = buildCoverImagePrompt(input, settings.promptStyles[input.category]);

  try {
    const response = await fetch(imageGenerationsUrl(settings.apiBaseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.model,
        prompt,
        n: 1,
        size: settings.size,
        quality: settings.quality,
        output_format: settings.outputFormat,
        response_format: "b64_json"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${providerLabel(settings.apiBaseUrl)} image generation failed: ${response.status} ${errorText}`
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{
        b64_json?: string;
        revised_prompt?: string;
      }>;
    };
    const b64Json = payload.data?.[0]?.b64_json;
    if (!b64Json) {
      throw new Error("Image generation provider did not return image data.");
    }

    return {
      buffer: Buffer.from(b64Json, "base64"),
      mimeType: imageMimeType(settings.outputFormat),
      prompt: payload.data?.[0]?.revised_prompt || prompt,
      model: settings.model
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${providerLabel(settings.apiBaseUrl)} image generation timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
