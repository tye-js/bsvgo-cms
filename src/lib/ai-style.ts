export const aiWritingRoles = [
  {
    id: "technical_editor",
    label: "技术编辑",
    description: "适合协议、架构、开发者工具、技术解读。",
    defaultStyle:
      "以技术编辑视角写作：结构清晰、概念准确、术语稳定。先交代背景和问题，再解释机制、影响和实践建议。保留关键事实、数据、链接、代码和限制条件，不制造素材之外的结论。"
  },
  {
    id: "news_analyst",
    label: "资讯分析师",
    description: "适合新闻、行业动态、事件复盘。",
    defaultStyle:
      "以资讯分析师视角写作：先说明发生了什么、为什么重要、对 BSV/区块链/AI 生态的影响。语气客观冷静，避免标题党，区分事实、背景和判断。"
  },
  {
    id: "product_marketer",
    label: "产品营销顾问",
    description: "适合产品、服务、工具、推广内容。",
    defaultStyle:
      "以产品营销顾问视角写作：突出使用场景、用户痛点、解决方案和可信收益。营销表达要克制、具体、基于事实，不夸大承诺，不写空泛口号。"
  },
  {
    id: "educator",
    label: "科普讲解者",
    description: "适合入门教程、概念科普、知识整理。",
    defaultStyle:
      "以科普讲解者视角写作：用易懂语言解释复杂概念，循序渐进，多用小标题、例子和对比。默认读者聪明但不熟悉背景，避免堆砌术语。"
  },
  {
    id: "opinion_columnist",
    label: "观点专栏作者",
    description: "适合评论、趋势判断、立场型文章。",
    defaultStyle:
      "以观点专栏作者视角写作：观点鲜明但不过度武断，先给结论，再用事实和逻辑支撑。明确区分事实与推断，避免未经素材支持的断言。"
  }
] as const;

export type AiWritingRoleId = (typeof aiWritingRoles)[number]["id"];

export const aiWritingRoleIds = aiWritingRoles.map((role) => role.id) as [
  AiWritingRoleId,
  ...AiWritingRoleId[]
];

export const DEFAULT_AI_WRITING_ROLE_ID: AiWritingRoleId = "technical_editor";

export function isAiWritingRoleId(value: string): value is AiWritingRoleId {
  return aiWritingRoles.some((role) => role.id === value);
}

export function getAiWritingRole(id: string | undefined) {
  return (
    aiWritingRoles.find((role) => role.id === id) ??
    aiWritingRoles.find((role) => role.id === DEFAULT_AI_WRITING_ROLE_ID) ??
    aiWritingRoles[0]
  );
}

export const DEFAULT_AI_ZH_SEO_STYLE =
  "中文 SEO 面向中文搜索和中文前端页面。标题自然包含核心关键词，优先 24-32 个汉字内；描述提炼关键价值、场景和差异点，约 80-120 个汉字。关键词使用中文读者会搜索的词，技术名词可保留英文缩写。";

export const DEFAULT_AI_EN_SEO_STYLE =
  "English SEO is for the English frontend page. Use natural, search-friendly phrasing for technical readers; keep titles concise, ideally under 60 characters, and descriptions around 120-160 characters. Extract concrete keywords from the article instead of generic buzzwords.";
