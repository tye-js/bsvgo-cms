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

export async function generateEnglishPost(
  input: EnglishPostInput
): Promise<EnglishPostOutput> {
  const { apiKey, apiBaseUrl, model, timeoutMs } = await getAiSettingsForGeneration();
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
        text: {
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
              required: [
                "title",
                "excerpt",
                "content",
                "seoTitle",
                "seoDescription"
              ]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${providerLabel(apiBaseUrl)} request failed: ${response.status} ${errorText}`
      );
    }

    return parseEnglishPost(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${providerLabel(apiBaseUrl)} generation timed out. Please try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
