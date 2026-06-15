INSERT INTO "app_settings" ("key", "value", "encrypted")
VALUES
  ('ai.openai.api_base_url', 'https://api.deepseek.com', false),
  ('ai.openai.model', 'deepseek-v4-pro', false),
  ('ai.openai.timeout_ms', '60000', false),
  ('ai.openai.writing_style', $bsvgo$面向 BSVgo 技术读者，语言清晰、克制、可信。优先使用结构化小标题、短段落和 Markdown 正文，不输出 HTML。所有事实、数据、人物、时间、链接、代码、产品能力和因果判断必须来自素材或明确标注为推断；素材不足时要保守表达，不编造细节。允许适度营销，但必须具体、可验证、不过度承诺。中文正文自然专业，英文正文面向全球技术读者，避免中式直译。Slug 使用小写英文、数字和连字符，简短表达核心主题。SEO 要分别服务中文入口和英文入口，提炼真实关键词，不堆砌。$bsvgo$, false),
  ('ai.openai.default_writing_role', 'technical_editor', false),
  ('ai.openai.zh_seo_style', $bsvgo$中文 SEO 面向中文搜索和中文前端页面。标题自然包含核心关键词，优先 24-32 个汉字内，不堆关键词，不使用夸张营销词。描述提炼关键价值、适用场景、差异点和读者收益，约 80-120 个汉字。关键词使用中文读者会搜索的词，技术名词可保留英文缩写。分类、标签、文章页都要避免重复模板化表达。$bsvgo$, false),
  ('ai.openai.en_seo_style', $bsvgo$English SEO is for the English frontend page. Use natural, search-friendly phrasing for technical readers; keep titles concise, ideally under 60 characters, and descriptions around 120-160 characters. Extract concrete keywords from the article instead of generic buzzwords. Avoid clickbait, keyword stuffing, and vague claims. Keep BSV, blockchain, and AI terms precise and readable for global readers.$bsvgo$, false),
  ('ai.openai.writing_role.technical_editor.style', $bsvgo$以技术编辑视角写作：结构清晰、概念准确、术语稳定。先交代背景和问题，再解释机制、影响和实践建议。保留关键事实、数据、链接、代码、版本、限制条件和不确定性，不制造素材之外的结论。遇到协议、性能、安全、架构类主题时，优先解释原理、边界、权衡和对开发者的实际意义。中文稿避免直译腔，英文稿保持专业技术写作风格。$bsvgo$, false),
  ('ai.openai.writing_role.news_analyst.style', $bsvgo$以资讯分析师视角写作：先说明发生了什么、涉及谁、时间线是什么，再解释为什么重要，以及对 BSV、区块链、AI 或开发者生态的影响。语气客观冷静，避免标题党和情绪化判断。明确区分事实、背景、引用观点和作者判断；如果素材不足以证明影响，要使用谨慎措辞。$bsvgo$, false),
  ('ai.openai.writing_role.product_marketer.style', $bsvgo$以产品营销顾问视角写作：突出使用场景、目标用户、痛点、解决方案、差异点和可信收益。营销表达要克制、具体、基于事实，不夸大承诺，不写空泛口号。优先把优势落到可验证的功能、流程、成本、效率或体验改善上；必要时加入轻量 CTA，但不要牺牲专业可信度。$bsvgo$, false),
  ('ai.openai.writing_role.educator.style', $bsvgo$以科普讲解者视角写作：用易懂语言解释复杂概念，循序渐进，多用小标题、例子、类比和对比。默认读者聪明但不熟悉背景，先解释术语再展开推理。避免堆砌概念和一次性引入过多缩写；如果涉及 BSV、区块链或 AI 基础知识，要补足必要上下文但不偏离主题。$bsvgo$, false),
  ('ai.openai.writing_role.opinion_columnist.style', $bsvgo$以观点专栏作者视角写作：观点鲜明但不过度武断，先给结论，再用事实、背景和逻辑支撑。明确区分事实、推断和价值判断，避免未经素材支持的断言。可以提出趋势判断和反直觉观点，但必须交代判断依据、适用边界和可能的反例。$bsvgo$, false),
  ('ai.image.api_base_url', 'https://api.openai.com/v1', false),
  ('ai.image.model', 'gpt-image-2', false),
  ('ai.image.size', '1536x1024', false),
  ('ai.image.quality', 'auto', false),
  ('ai.image.output_format', 'png', false),
  ('ai.image.timeout_ms', '180000', false),
  ('ai.image.prompt_style', $bsvgo$为 BSVgo 区块链类文章生成一张专业、可信、具有传播吸引力的原创封面。画面要像高端技术媒体的头图，围绕文章标题和描述提炼一个清晰视觉主概念，突出 BSV、区块链网络、交易流、数据结构、可扩展系统或开发者工程场景。构图应有明确焦点、强缩略图识别度和社媒分享吸引力，适合横向文章封面和推广卡片；风格现代、精致、克制，有深度但不晦涩。避免可读文字、Logo、人物肖像、币价图、暴富暗示、夸张金融符号和廉价科幻感。$bsvgo$, false),
  ('ai.image.prompt_style.blockchain', $bsvgo$为 BSVgo 区块链类文章生成一张专业、可信、具有传播吸引力的原创封面。画面要像高端技术媒体的头图，围绕文章标题和描述提炼一个清晰视觉主概念，突出 BSV、区块链网络、交易流、数据结构、可扩展系统或开发者工程场景。构图应有明确焦点、强缩略图识别度和社媒分享吸引力，适合横向文章封面和推广卡片；风格现代、精致、克制，有深度但不晦涩。避免可读文字、Logo、人物肖像、币价图、暴富暗示、夸张金融符号和廉价科幻感。$bsvgo$, false),
  ('ai.image.prompt_style.ai', $bsvgo$为 BSVgo 人工智能类文章生成一张专业、前沿、容易被点击和转发的原创封面。画面要根据文章标题和描述定制视觉主题，体现 AI 模型、推理流程、自动化工作流、数据处理、智能代理或开发者工具的真实应用价值。构图应简洁有力量，具备清晰主视觉、层次感和推广海报级吸引力，适合技术读者在列表页和社交媒体中快速理解主题。风格现代、可信、精密，避免可读文字、Logo、人物肖像、夸张机器人脸、虚假能力暗示、过度赛博朋克和廉价炫光。$bsvgo$, false),
  ('ai.image.prompt_style.infrastructure', $bsvgo$为 BSVgo 基础设施类文章生成一张专业、稳定、具有推广价值的原创封面。画面要根据文章标题和描述提炼基础设施核心卖点，表现云服务、节点网络、数据库、API、安全、监控、部署、扩展性或运维可靠性。构图应清晰、扎实、有可信的工程质感，适合横向文章封面、产品更新和社媒分发；视觉要有记忆点，但不喧宾夺主。避免可读文字、Logo、人物肖像、杂乱机房、过度抽象线条、廉价蓝图风和误导性金融暗示。$bsvgo$, false),
  ('seo.home.en.title', '', false),
  ('seo.home.en.description', '', false),
  ('seo.home.en.keywords', '', false),
  ('seo.home.en.og_title', '', false),
  ('seo.home.en.og_description', '', false),
  ('seo.home.zh.title', '', false),
  ('seo.home.zh.description', '', false),
  ('seo.home.zh.keywords', '', false),
  ('seo.home.zh.og_title', '', false),
  ('seo.home.zh.og_description', '', false),
  ('seo.home.og_image', '', false),
  ('seo.home.canonical_url', '', false),
  ('seo.home.title', '', false),
  ('seo.home.description', '', false),
  ('seo.home.keywords', '', false),
  ('seo.home.og_title', '', false),
  ('seo.home.og_description', '', false)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

UPDATE "app_settings"
SET "value" = $bsvgo$为 BSVgo 区块链类文章生成一张专业、可信、具有传播吸引力的原创封面。画面要像高端技术媒体的头图，围绕文章标题和描述提炼一个清晰视觉主概念，突出 BSV、区块链网络、交易流、数据结构、可扩展系统或开发者工程场景。构图应有明确焦点、强缩略图识别度和社媒分享吸引力，适合横向文章封面和推广卡片；风格现代、精致、克制，有深度但不晦涩。避免可读文字、Logo、人物肖像、币价图、暴富暗示、夸张金融符号和廉价科幻感。$bsvgo$,
    "updated_at" = now()
WHERE "encrypted" = false
  AND "key" IN ('ai.image.prompt_style', 'ai.image.prompt_style.blockchain')
  AND "value" IN (
    $bsvgo$为 BSVgo 技术博客生成原创封面图。画面应专业、清晰、现代，适合区块链、BSV、AI、开发者工具和技术文章。避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$,
    $bsvgo$为 BSVgo 区块链类技术博客生成原创封面图。画面应体现 BSV、区块链系统、交易网络、数据结构、可扩展性和开发者工程感。风格专业、清晰、现代，避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$
  );
--> statement-breakpoint

UPDATE "app_settings"
SET "value" = $bsvgo$为 BSVgo 人工智能类文章生成一张专业、前沿、容易被点击和转发的原创封面。画面要根据文章标题和描述定制视觉主题，体现 AI 模型、推理流程、自动化工作流、数据处理、智能代理或开发者工具的真实应用价值。构图应简洁有力量，具备清晰主视觉、层次感和推广海报级吸引力，适合技术读者在列表页和社交媒体中快速理解主题。风格现代、可信、精密，避免可读文字、Logo、人物肖像、夸张机器人脸、虚假能力暗示、过度赛博朋克和廉价炫光。$bsvgo$,
    "updated_at" = now()
WHERE "encrypted" = false
  AND "key" = 'ai.image.prompt_style.ai'
  AND "value" IN (
    $bsvgo$为 BSVgo 技术博客生成原创封面图。画面应专业、清晰、现代，适合区块链、BSV、AI、开发者工具和技术文章。避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$,
    $bsvgo$为 BSVgo 人工智能类技术博客生成原创封面图。画面应体现 AI 工作流、模型推理、自动化、数据处理和开发者工具感，与文章主题紧密相关。风格专业、克制、现代，避免文字、Logo、人物肖像、夸张科幻元素和误导性能力暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$
  );
--> statement-breakpoint

UPDATE "app_settings"
SET "value" = $bsvgo$为 BSVgo 基础设施类文章生成一张专业、稳定、具有推广价值的原创封面。画面要根据文章标题和描述提炼基础设施核心卖点，表现云服务、节点网络、数据库、API、安全、监控、部署、扩展性或运维可靠性。构图应清晰、扎实、有可信的工程质感，适合横向文章封面、产品更新和社媒分发；视觉要有记忆点，但不喧宾夺主。避免可读文字、Logo、人物肖像、杂乱机房、过度抽象线条、廉价蓝图风和误导性金融暗示。$bsvgo$,
    "updated_at" = now()
WHERE "encrypted" = false
  AND "key" = 'ai.image.prompt_style.infrastructure'
  AND "value" IN (
    $bsvgo$为 BSVgo 技术博客生成原创封面图。画面应专业、清晰、现代，适合区块链、BSV、AI、开发者工具和技术文章。避免文字、Logo、人物肖像、夸张币价视觉和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$,
    $bsvgo$为 BSVgo 基础设施类技术博客生成原创封面图。画面应体现云服务、节点、网络、数据库、安全、运维和产品基础设施。风格专业、清晰、可靠，避免文字、Logo、人物肖像、过度抽象装饰和误导性金融暗示。构图适合横向文章封面，留出标题覆盖空间。$bsvgo$
  );
