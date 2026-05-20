import "server-only";

import type { AiWritingRoleId } from "@/lib/ai-style";
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
  writingRole?: AiWritingRoleId;
  rawInput?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceContent?: string;
};

type ChineseDraftCoreInput = ChineseDraftInput;

type DraftTranslationInput = {
  writingRole?: AiWritingRoleId;
  zhTitle: string;
  zhExcerpt?: string;
  zhContent: string;
};

type DraftMetadataInput = {
  zhTitle: string;
  zhExcerpt?: string;
  zhContent: string;
  enTitle: string;
  enExcerpt?: string;
  enContent: string;
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
  zh: {
    seoTitle: string;
    seoDescription: string;
  };
  en: {
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
      seoDescription: clean(parsed.zh?.seoDescription, 500)
    },
    en: {
      seoTitle: clean(parsed.en?.seoTitle, 255),
      seoDescription: clean(parsed.en?.seoDescription, 500)
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
              "You are the BSVgo CMS metadata editor. Generate a concise URL slug plus SEO titles and descriptions for both Simplified Chinese and English pages. Keep them search-friendly, accurate, natural, and aligned with the configured locale-specific SEO styles."
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
              }
            },
            required: ["seoTitle", "seoDescription"]
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
              }
            },
            required: ["seoTitle", "seoDescription"]
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
