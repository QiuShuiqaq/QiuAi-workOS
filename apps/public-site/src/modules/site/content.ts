import type { SiteLanguage } from "@/types/site";
import type {
  EditableDocItem,
  EditableResourceItem,
  EditableShowcaseItem,
  HomeFeedGithubHistory,
  HomeFeedSettings,
  HomeFeedSnapshot,
} from "@/types/site";

type LocalizedText = Record<SiteLanguage, string>;

export function readText(text: LocalizedText, lang: SiteLanguage) {
  return text[lang];
}

export const siteShellCopy = {
  title: {
    zh: "QiuAI WorkOS",
    en: "QiuAI WorkOS",
  },
  subtitle: {
    zh: "企业 AI 工作系统",
    en: "Enterprise AI Work System",
  },
  nav: {
    home: { zh: "首页", en: "Home" },
    downloads: { zh: "下载", en: "Downloads" },
    docs: { zh: "文档", en: "Docs" },
    developer: { zh: "开发者", en: "Developer" },
  },
};

export const defaultDeveloperProfile = {
  projects: [
    {
      slug: "qiu-commerce-license-platform",
      nameZh: "Qiu Commerce License Platform",
      nameEn: "Qiu Commerce License Platform",
      summaryZh: "围绕授权、下载、文档和后台管理构建的一体化平台基础。",
      summaryEn: "An integrated platform foundation for licensing, downloads, documentation, and administration.",
      githubUrl: "https://github.com/QiuShuiqaq/qiu-commerce-license-platform",
    },
    {
      slug: "qiuai-client",
      nameZh: "QIUAI 客户端",
      nameEn: "QIUAI Client",
      summaryZh: "面向桌面工作流的 AI 工具客户端，连接授权体系与实际使用场景。",
      summaryEn: "A desktop AI client that connects licensing workflows with practical usage scenarios.",
      githubUrl: "https://github.com/QiuShuiqaq",
    },
  ],
  name: "Qiu",
  roleZh: "独立开发者",
  roleEn: "Independent Developer",
  summaryZh: "做 AI 工具、桌面软件、自动化脚本，也写开发里碰到的问题和做法。",
  summaryEn: "Focused on AI applications, workflow automation, desktop tools, and practical knowledge systems.",
  longBioZh:
    "这个站点放我平时在用的软件、做过的项目、写下来的笔记，还有一些能直接下载的文件。需要什么就进对应页面，不绕弯。",
  longBioEn:
    "This site is my long-term technical archive for AI tools, programming notes, software resources, and project experience.",
  email: "3431752914@qq.com",
  location: "Zhejiang, China",
  websiteLabel: "秋水code花园",
  websiteUrl: "https://qiuaihub.com",
  githubUrl: "https://github.com/QiuShuiqaq",
  notesZh: "项目、下载和文档都会继续往里补，改动也会直接反映在这里。",
  notesEn: "The public site is used for content publishing, archiving, and downloads. Project notes and learning records will be updated continuously.",
};

export const defaultHomeEditableContent = {
  eyebrowZh: "QiuAI WorkOS",
  eyebrowEn: "QiuAI WorkOS",
  titleZh: "企业 AI 数字员工与数字工厂工作系统",
  titleEn: "Enterprise AI work system for digital workers and digital factories",
  summaryZh:
    "这里提供 QiuAI WorkOS 的产品介绍、Windows 客户端下载、使用文档和企业部署入口。",
  summaryEn:
    "Product information, Windows client downloads, documentation, and enterprise deployment entry points for QiuAI WorkOS.",
  primaryActionLabelZh: "下载客户端",
  primaryActionLabelEn: "Download client",
  secondaryActionLabelZh: "查看文档",
  secondaryActionLabelEn: "Read docs",
  contactTitleZh: "联系与备案",
  contactTitleEn: "Contact and filing",
  contactDescriptionZh: "企业试用、部署和问题反馈可以通过页脚邮箱联系。",
  contactDescriptionEn: "Use the footer emails for enterprise trials, deployment, and feedback.",
  icpText: "浙ICP备2026043969号-1",
};

export const defaultDemoEditableContent = {
  eyebrowZh: "已停用",
  eyebrowEn: "Deprecated",
  titleZh: "公开展示页已下线",
  titleEn: "Public demo page retired",
  summaryZh: "展示相关内容不再作为公开站导航的一部分。",
  summaryEn: "Demo content is no longer part of the public navigation.",
};

export const defaultResourcesEditableContent = {
  eyebrowZh: "客户端下载",
  eyebrowEn: "Client Download",
  titleZh: "QiuAI WorkOS Windows 客户端下载",
  titleEn: "QiuAI WorkOS Windows Client Download",
  summaryZh: "这里维护 WorkOS 客户端安装包、版本信息和必要的安装说明。",
  summaryEn: "WorkOS client installers, version information, and setup notes are maintained here.",
};

export const defaultDocsEditableContent = {
  eyebrowZh: "使用文档",
  eyebrowEn: "Docs",
  titleZh: "QiuAI WorkOS 使用文档",
  titleEn: "QiuAI WorkOS Documentation",
  summaryZh: "这里会逐步沉淀客户端安装、模型配置、知识库、数字员工和数字工厂使用说明，并保留必要的 AI 基础概念资料。",
  summaryEn: "Client setup, model configuration, knowledge bases, digital workers, and digital factories will be documented here, alongside essential AI concept notes.",
};

export const defaultHomeFeedSettings: HomeFeedSettings = {
  newsLimit: 6,
  techLimit: 6,
  githubLimit: 6,
  weeklySources: [
    "openai-news",
    "anthropic-news",
    "deepmind-blog",
    "google-ai-blog",
    "anthropic-engineering",
    "huggingface-blog",
    "huggingface-papers",
    "arxiv-ai",
  ],
  monthlySources: ["github-search"],
  sourceWeights: {
    "openai-news": 100,
    "anthropic-news": 94,
    "deepmind-blog": 92,
    "google-ai-blog": 88,
    "anthropic-engineering": 95,
    "huggingface-blog": 90,
    "huggingface-papers": 96,
    "arxiv-ai": 84,
    "github-search": 100,
  },
};

export const defaultHomeFeedGithubHistory: HomeFeedGithubHistory = {
  capturedAt: "2026-06-01T00:00:00.000Z",
  items: [
    {
      repository: "openai/openai-cookbook",
      stars: 66000,
      forks: 11000,
      pushedAt: "2026-05-30T12:00:00.000Z",
    },
    {
      repository: "anthropics/anthropic-cookbook",
      stars: 21000,
      forks: 2600,
      pushedAt: "2026-05-31T09:00:00.000Z",
    },
    {
      repository: "microsoft/autogen",
      stars: 51000,
      forks: 7600,
      pushedAt: "2026-05-29T16:00:00.000Z",
    },
  ],
};

export const defaultHomeFeedSnapshot: HomeFeedSnapshot = {
  generatedAt: "2026-06-23T00:00:00.000Z",
  news: {
    key: "news",
    titleZh: "AI 资讯",
    titleEn: "AI News",
    updatedAt: "2026-06-23T00:00:00.000Z",
    featuredItem: {
      id: "news-openai-ops",
      kind: "NEWS",
      titleZh: "OpenAI 发布新的模型与平台更新",
      titleEn: "OpenAI ships new model and platform updates",
      summaryZh: "聚焦模型能力、开发接口与产品落地节奏，适合作为近期 AI 动向入口。",
      summaryEn: "A recent update focused on model capability, developer APIs, and product rollout signals.",
      sourceName: "OpenAI News",
      sourceUrl: "https://openai.com/news/",
      externalUrl: "https://openai.com/news/",
      publishedAt: "2026-06-20T00:00:00.000Z",
      heatScore: 98,
      tags: ["OpenAI", "Model", "Platform"],
      metrics: {
        sourceWeight: 100,
      },
    },
    items: [
      {
        id: "news-openai-ops",
        kind: "NEWS",
        titleZh: "OpenAI 发布新的模型与平台更新",
        titleEn: "OpenAI ships new model and platform updates",
        summaryZh: "聚焦模型能力、开发接口与产品落地节奏，适合作为近期 AI 动向入口。",
        summaryEn: "A recent update focused on model capability, developer APIs, and product rollout signals.",
        sourceName: "OpenAI News",
        sourceUrl: "https://openai.com/news/",
        externalUrl: "https://openai.com/news/",
        publishedAt: "2026-06-20T00:00:00.000Z",
        heatScore: 98,
        tags: ["OpenAI", "Model", "Platform"],
        metrics: {
          sourceWeight: 100,
        },
      },
      {
        id: "news-anthropic-safety",
        kind: "NEWS",
        titleZh: "Anthropic 更新模型安全与产品动态",
        titleEn: "Anthropic updates model safety and product notes",
        summaryZh: "适合跟进模型能力边界、安全实践与商业产品节奏。",
        summaryEn: "Useful for tracking capability boundaries, safety practice, and product rollout cadence.",
        sourceName: "Anthropic News",
        sourceUrl: "https://www.anthropic.com/news",
        externalUrl: "https://www.anthropic.com/news",
        publishedAt: "2026-06-18T00:00:00.000Z",
        heatScore: 92,
        tags: ["Anthropic", "Safety", "Product"],
        metrics: {
          sourceWeight: 94,
        },
      },
      {
        id: "news-deepmind-research",
        kind: "NEWS",
        titleZh: "DeepMind 发布最新研究与系统进展",
        titleEn: "DeepMind shares recent research and system progress",
        summaryZh: "覆盖研究进展、模型系统能力与工程落地方向。",
        summaryEn: "Covers research progress, model system capability, and engineering direction.",
        sourceName: "Google DeepMind Blog",
        sourceUrl: "https://deepmind.google/discover/blog/",
        externalUrl: "https://deepmind.google/discover/blog/",
        publishedAt: "2026-06-16T00:00:00.000Z",
        heatScore: 88,
        tags: ["DeepMind", "Research"],
        metrics: {
          sourceWeight: 92,
        },
      },
    ],
  },
  tech: {
    key: "tech",
    titleZh: "AI 技术",
    titleEn: "AI Technology",
    updatedAt: "2026-06-23T00:00:00.000Z",
    featuredItem: {
      id: "tech-hf-papers",
      kind: "TECH",
      titleZh: "Hugging Face 热门论文与工程实践",
      titleEn: "Hugging Face trending papers and engineering practice",
      summaryZh: "适合快速跟进近期模型论文、实现方法与工程热点。",
      summaryEn: "A practical entry to recent model papers, implementation patterns, and engineering trends.",
      sourceName: "Hugging Face",
      sourceUrl: "https://huggingface.co/papers",
      externalUrl: "https://huggingface.co/papers",
      publishedAt: "2026-06-21T00:00:00.000Z",
      heatScore: 97,
      tags: ["Paper", "LLM", "Engineering"],
      metrics: {
        sourceWeight: 96,
      },
    },
    items: [
      {
        id: "tech-hf-papers",
        kind: "TECH",
        titleZh: "Hugging Face 热门论文与工程实践",
        titleEn: "Hugging Face trending papers and engineering practice",
        summaryZh: "适合快速跟进近期模型论文、实现方法与工程热点。",
        summaryEn: "A practical entry to recent model papers, implementation patterns, and engineering trends.",
        sourceName: "Hugging Face",
        sourceUrl: "https://huggingface.co/papers",
        externalUrl: "https://huggingface.co/papers",
        publishedAt: "2026-06-21T00:00:00.000Z",
        heatScore: 97,
        tags: ["Paper", "LLM", "Engineering"],
        metrics: {
          sourceWeight: 96,
        },
      },
      {
        id: "tech-anthropic-engineering",
        kind: "TECH",
        titleZh: "Anthropic 工程博客中的上下文与系统设计",
        titleEn: "Context and system design from Anthropic Engineering",
        summaryZh: "更偏工程实践，适合看真实系统设计取舍。",
        summaryEn: "Engineering-oriented material focused on concrete system tradeoffs.",
        sourceName: "Anthropic Engineering",
        sourceUrl: "https://www.anthropic.com/engineering",
        externalUrl: "https://www.anthropic.com/engineering",
        publishedAt: "2026-06-19T00:00:00.000Z",
        heatScore: 91,
        tags: ["Systems", "Context", "Infra"],
        metrics: {
          sourceWeight: 95,
        },
      },
      {
        id: "tech-arxiv-ai",
        kind: "TECH",
        titleZh: "arXiv AI 方向近期论文跟踪",
        titleEn: "Recent arXiv AI paper tracking",
        summaryZh: "适合补全前沿研究的覆盖面，再结合工程文章判断落地价值。",
        summaryEn: "Useful for broad frontier coverage before deciding implementation value.",
        sourceName: "arXiv",
        sourceUrl: "https://arxiv.org/list/cs.AI/recent",
        externalUrl: "https://arxiv.org/list/cs.AI/recent",
        publishedAt: "2026-06-17T00:00:00.000Z",
        heatScore: 84,
        tags: ["arXiv", "Research", "AI"],
        metrics: {
          sourceWeight: 84,
        },
      },
    ],
  },
  github: {
    key: "github",
    titleZh: "GitHub 热门项目",
    titleEn: "GitHub Trending Repositories",
    updatedAt: "2026-06-23T00:00:00.000Z",
    featuredItem: {
      id: "github-microsoft-autogen",
      kind: "GITHUB",
      titleZh: "microsoft/autogen",
      titleEn: "microsoft/autogen",
      summaryZh: "多智能体与自动化编排方向的高关注仓库，适合观察 Agent 体系的工程实践。",
      summaryEn: "A high-signal repository for agent orchestration and automation workflows.",
      sourceName: "GitHub",
      sourceUrl: "https://github.com",
      externalUrl: "https://github.com/microsoft/autogen",
      publishedAt: "2026-06-22T00:00:00.000Z",
      heatScore: 95,
      tags: ["agent", "automation", "llm"],
      metrics: {
        githubStars: 54000,
        githubForks: 8200,
        githubStarDelta30d: 3000,
      },
    },
    items: [
      {
        id: "github-microsoft-autogen",
        kind: "GITHUB",
        titleZh: "microsoft/autogen",
        titleEn: "microsoft/autogen",
        summaryZh: "多智能体与自动化编排方向的高关注仓库，适合观察 Agent 体系的工程实践。",
        summaryEn: "A high-signal repository for agent orchestration and automation workflows.",
        sourceName: "GitHub",
        sourceUrl: "https://github.com",
        externalUrl: "https://github.com/microsoft/autogen",
        publishedAt: "2026-06-22T00:00:00.000Z",
        heatScore: 95,
        tags: ["agent", "automation", "llm"],
        metrics: {
          githubStars: 54000,
          githubForks: 8200,
          githubStarDelta30d: 3000,
        },
      },
      {
        id: "github-openai-cookbook",
        kind: "GITHUB",
        titleZh: "openai/openai-cookbook",
        titleEn: "openai/openai-cookbook",
        summaryZh: "覆盖 API 使用、工作流模式和参考实现，适合作为实战入口。",
        summaryEn: "A practical repository for API usage, workflow patterns, and reference implementations.",
        sourceName: "GitHub",
        sourceUrl: "https://github.com",
        externalUrl: "https://github.com/openai/openai-cookbook",
        publishedAt: "2026-06-21T00:00:00.000Z",
        heatScore: 90,
        tags: ["openai", "cookbook", "api"],
        metrics: {
          githubStars: 69000,
          githubForks: 11500,
          githubStarDelta30d: 2000,
        },
      },
      {
        id: "github-anthropic-cookbook",
        kind: "GITHUB",
        titleZh: "anthropics/anthropic-cookbook",
        titleEn: "anthropics/anthropic-cookbook",
        summaryZh: "偏工程实作的示例集合，适合对比不同模型接入方式。",
        summaryEn: "An implementation-oriented cookbook for comparing model integration patterns.",
        sourceName: "GitHub",
        sourceUrl: "https://github.com",
        externalUrl: "https://github.com/anthropics/anthropic-cookbook",
        publishedAt: "2026-06-20T00:00:00.000Z",
        heatScore: 82,
        tags: ["anthropic", "cookbook", "integration"],
        metrics: {
          githubStars: 23000,
          githubForks: 2800,
          githubStarDelta30d: 1800,
        },
      },
    ],
  },
};

export const homeCopy = {
  positioning: [
    {
      title: { zh: "AI", en: "AI" },
      description: {
        zh: "文本、图片、视频、智能体这些东西，我会直接写怎么用。",
        en: "Practical AI usage across text, image, video, agents, and automation workflows.",
      },
    },
    {
      title: { zh: "技术", en: "Technology" },
      description: {
        zh: "主要是代码、部署、工具链和排错。",
        en: "Programming, engineering practice, tooling, and deployment notes without empty buzzwords.",
      },
    },
    {
      title: { zh: "信息", en: "Information" },
      description: {
        zh: "零散资料会重新归一遍，后面找起来快一点。",
        en: "Organized reference structures that reduce lookup and reuse cost over time.",
      },
    },
    {
      title: { zh: "资源", en: "Resources" },
      description: {
        zh: "能下载的东西放一起，省得来回找。",
        en: "Software downloads, tutorials, and long-term maintained materials in one place.",
      },
    },
  ],
};

export const defaultShowcaseItems: EditableShowcaseItem[] = [
  {
    slug: "qiushui-code-garden",
    categoryZh: "个人站点",
    categoryEn: "Personal Site",
    statusZh: "维护中",
    statusEn: "Active",
    titleZh: "秋水code花园",
    titleEn: "Qiushui Code Garden",
    summaryZh: "一个以 AI、技术、信息和资源整理为核心的长期更新站点。",
    summaryEn: "A long-term updated site focused on AI, technology, information, and resources.",
    heroTitleZh: "把分散资料整理成稳定可用的公共入口",
    heroTitleEn: "Turn scattered notes into a stable public entry point",
    heroDescriptionZh: "强调真实内容、简单结构和长期维护，而不是营销式页面包装。",
    heroDescriptionEn: "Built around real content, simple structure, and long-term maintenance rather than sales-driven presentation.",
    primaryCtaLabelZh: "查看",
    primaryCtaLabelEn: "View",
    tags: ["AI", "Docs", "Resources"],
    highlightsZh: ["公开页面只保留必要入口", "内容长期维护", "避免交易表达"],
    highlightsEn: [
      "Only essential public entry points are kept",
      "Content is maintained continuously",
      "No transaction-oriented wording",
    ],
    gallery: [
      {
        titleZh: "首页入口",
        titleEn: "Home Entry",
        descriptionZh: "统一说明站点用途和内容方向。",
        descriptionEn: "Clarifies the site's purpose and content direction.",
      },
    ],
    sections: [
      {
        titleZh: "用途",
        titleEn: "Purpose",
        paragraphsZh: ["作为 AI、技术、信息和资源内容的公开归档与长期更新入口。"],
        paragraphsEn: ["A public archive and long-term update hub for AI, technology, information, and resources."],
      },
    ],
  },
];

export const defaultResourceItems: EditableResourceItem[] = [
  {
    slug: "qiuai-workos-windows",
    titleZh: "QiuAI WorkOS Windows 客户端",
    titleEn: "QiuAI WorkOS Windows Client",
    summaryZh: "面向企业数字员工与数字工厂的 Windows 桌面端，支持本地文件、Office 文档、模型配置、知识库和批量产物处理。",
    summaryEn: "Windows desktop client for enterprise digital workers and digital factories, with local files, Office documents, model configuration, knowledge bases, and batch artifact workflows.",
    formatZh: "EXE",
    formatEn: "EXE",
    platformZh: "Windows",
    platformEn: "Windows",
    version: "v1.0.0",
    fileSize: "以 GitHub Release 为准",
    updatedAt: "2026-08-03",
    fileName: "QiuAI WorkOS Setup 1.0.0.exe",
    downloadPath: null,
    tutorialPdfName: null,
    tutorialPdfPath: null,
    notesZh: ["适用于 Windows 10/11 x64。", "安装后请先绑定企业账号，再配置模型供应商。"],
    notesEn: ["For Windows 10/11 x64.", "Bind your enterprise account and configure model providers after installation."],
  },
];

export const defaultDocItems: EditableDocItem[] = [
  {
    slug: "ai-agent",
    parentSlug: null,
    sortOrder: 10,
    titleZh: "AI Agent（智能体）",
    titleEn: "AI Agent",
    summaryZh: "从任务目标、记忆、工具、工作流和执行边界理解智能体，不把它当成单纯的聊天机器人。",
    summaryEn: "Understand agents through goals, memory, tools, workflow, and execution boundaries instead of treating them as chatbots.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "AI Agent 的核心不是会聊天，而是能围绕一个目标持续推进任务。它会读取上下文、调用工具、记录状态，再根据结果继续往下执行。",
          "智能体通常由模型、提示词、记忆、工具集、调度逻辑和结果回写机制组成。少一个环节，它都更像是问答机器人，而不是完整的执行系统。",
        ],
        bodyEn: [
          "An AI agent is defined by goal-driven execution, not just conversation.",
          "A complete agent combines a model, prompts, memory, tools, orchestration, and result handling.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合多步骤、有条件分支、需要查资料或调用外部能力的任务，例如自动整理资料、批量生成内容、工单分流、代码修复、运营自动化。",
          "如果任务只是一次提问一次回答，或者规则已经完全固定，没必要强行上智能体，普通 API 调用和脚本通常更稳定。",
        ],
        bodyEn: [
          "Agents fit multi-step tasks with branching, lookup, and tool usage.",
          "For one-shot prompts or fully fixed rules, a plain API call is usually simpler and more reliable.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "目标：系统必须明确自己要完成什么，否则智能体会在冗长输出里消耗成本却没有结果。",
          "记忆：短期记忆负责保留当前会话状态，长期记忆负责保留可复用事实。不要把所有历史都无脑塞给模型。",
          "工具：搜索、数据库、文件系统、浏览器、代码执行器都是工具。工具定义越清晰，模型的行为越稳定。",
          "反馈闭环：每一步执行后都要回收结果，决定是否继续、重试、终止或升级处理。",
        ],
        bodyEn: [
          "Goals, memory, tools, and feedback loops are the core agent primitives.",
          "Clear tool contracts and bounded state make agent behavior more stable.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "最常见的链路是：接收任务 -> 解析目标 -> 规划步骤 -> 调用工具 -> 校验结果 -> 写回状态 -> 继续下一步或结束。",
          "复杂系统会把规划、执行、审核拆成不同角色，例如规划 Agent 负责拆任务，执行 Agent 负责干活，审查 Agent 负责验收。",
          "如果链路里有高成本模型或外部平台调用，就要加队列、重试、超时和人工接管点，不然线上会很难收拾。",
        ],
        bodyEn: [
          "A common loop is goal intake, planning, tool execution, validation, state update, and continuation.",
          "Larger systems may split planning, execution, and review across separate roles.",
        ],
      },
      {
        titleZh: "常用工具 / 框架 / 组成",
        titleEn: "Common Tools and Frameworks",
        bodyZh: [
          "模型层常见的是 OpenAI、Anthropic、DeepSeek、Qwen 等；工具层常见的是 HTTP API、数据库、浏览器自动化、文件系统和代码执行环境。",
          "框架层常见有 LangChain、LangGraph、AutoGen、CrewAI。框架是帮你组织流程，不是替你完成系统设计。",
          "工程上更关键的是日志、状态表、任务队列、成本统计和失败重放能力，这些通常比框架名字更重要。",
        ],
        bodyEn: [
          "Models, tool APIs, browser automation, storage, and code execution are common building blocks.",
          "Frameworks help with orchestration, but observability and state management matter more in production.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把 prompt 当架构。提示词再长，也替代不了任务状态、权限边界和失败恢复设计。",
          "误区二是把所有步骤都交给模型自由发挥。越关键的步骤越要显式规则化，例如参数校验、额度控制、结果入库。",
          "误区三是实时轮询过于频繁。只要任务不是秒级完成，就要控制查询节奏，不然你的服务端和上游 API 都会被自己打爆。",
        ],
        bodyEn: [
          "Prompts are not architecture.",
          "Critical steps need explicit validation, limits, and persistence instead of unconstrained model behavior.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先做单 Agent，确认工具调用和状态回写打通，再扩展到多角色协作。",
          "实战时先从队列、日志、任务状态表、失败重试做起，这些基础能力到位后，再考虑更复杂的规划策略。",
          "如果要做商用服务，必须先定义清楚并发、配额、超时、失败归因和人工介入机制。",
        ],
        bodyEn: [
          "Start with a single agent and make tool use plus state persistence reliable first.",
          "For production, define concurrency, quotas, timeouts, retries, and escalation paths early.",
        ],
      },
    ],
  },
  {
    slug: "ai-basics",
    parentSlug: null,
    sortOrder: 20,
    titleZh: "AI（人工智能）",
    titleEn: "AI",
    summaryZh: "从能力边界、应用场景和工程落地理解 AI，不把 AI 简化成某一个大模型产品。",
    summaryEn: "Understand AI through capabilities, boundaries, use cases, and engineering delivery.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "AI 是一个总称，覆盖传统机器学习、深度学习、生成式模型、计算机视觉、语音处理、推荐系统等方向。",
          "现在大众讨论最多的是生成式 AI，但工程上真正要落地时，往往是生成式能力和传统系统能力一起工作。",
        ],
        bodyEn: [
          "AI covers classical ML, deep learning, generative models, vision, speech, and recommendation systems.",
          "Production systems often combine generative models with traditional software components.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "AI 适合处理规则难以穷尽、数据量大、表达形式复杂的问题，例如文本生成、信息抽取、图像理解、语音识别、推荐排序。",
          "如果业务是固定表单、固定规则和固定流程，优先用传统代码实现，AI 只放在真正需要泛化能力的地方。",
        ],
        bodyEn: [
          "AI helps when rules are incomplete, data is large, and input forms are complex.",
          "For rigid workflows, conventional software should stay in charge.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "模型：负责从数据中学习模式并给出预测或生成结果。",
          "训练数据：决定模型见过什么，影响模型偏差、覆盖范围和能力上限。",
          "推理：模型在生产环境里接收输入并产出结果的过程，速度、成本和稳定性都很关键。",
          "评估：不是只看能不能生成，而是看正确率、稳定性、成本、延迟和可控性。",
        ],
        bodyEn: [
          "Models, data, inference, and evaluation are the core AI building blocks.",
          "Production quality depends on accuracy, latency, cost, and controllability together.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "企业里常见的链路是：收集问题 -> 选技术方向 -> 做小范围验证 -> 接入业务数据 -> 搭 API 或服务 -> 做监控和复盘。",
          "生成式 AI 产品往往还要多一层内容安全、配额控制和结果审核，不然服务上线后很难稳定运营。",
        ],
        bodyEn: [
          "Typical delivery runs from problem framing to technical validation, data integration, service exposure, and monitoring.",
          "Generative products also need safety controls, quotas, and review policies.",
        ],
      },
      {
        titleZh: "常用工具 / 框架 / 方向",
        titleEn: "Common Tools and Directions",
        bodyZh: [
          "语言模型方向常见有 OpenAI、Anthropic、DeepSeek、Qwen；视觉方向常见有 OpenCV、YOLO、Diffusion；传统建模常见有 Scikit-learn、XGBoost。",
          "工具链上常见数据库、向量库、消息队列、对象存储、缓存和监控系统，这些决定系统能不能长期跑稳。",
        ],
        bodyEn: [
          "Different AI workloads rely on different model and tool stacks.",
          "Infrastructure choices heavily affect long-term stability.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把 AI 当万能外挂。很多问题不是模型能力不够，而是需求定义不清或数据质量太差。",
          "误区二是只看演示效果，不看长期成本。模型费用、延迟、上下文大小、失败率都会在真实用户量上放大。",
          "误区三是把模型输出当事实。所有关键业务都需要校验、约束或人工兜底。",
        ],
        bodyEn: [
          "AI is not a universal shortcut.",
          "Demo quality is not the same as long-term operating quality.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先分清传统机器学习、深度学习和生成式 AI 的差异，再根据自己的项目类型选择路线。",
          "如果目标是做产品，优先学 API 接入、评估、监控和业务工作流设计，不要一开始就沉迷模型训练。",
        ],
        bodyEn: [
          "Learn the difference between classical ML, deep learning, and generative AI first.",
          "Product builders should prioritize APIs, evaluation, monitoring, and workflow design.",
        ],
      },
    ],
  },
  {
    slug: "codex-tutorial",
    parentSlug: null,
    sortOrder: 30,
    titleZh: "Codex 教程",
    titleEn: "Codex Tutorial",
    summaryZh: "把 Codex 当成开发协作工具来使用，重点是任务拆解、代码变更、验证和交付，而不是单次聊天效果。",
    summaryEn: "Use Codex as a development collaborator focused on task breakdown, code changes, verification, and delivery.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Codex 更适合参与真实开发流程，例如阅读仓库、定位问题、改代码、跑测试、解释模块、补文档。",
          "它的价值不在于回答漂亮，而在于能否在约束下把任务完整做完。",
        ],
        bodyEn: [
          "Codex is most useful when embedded in real software delivery workflows.",
          "Its value comes from completing constrained tasks, not from stylish answers.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合多文件修改、需要上下文理解、需要验证结果的开发任务，例如排查 bug、改接口、补测试、梳理架构说明。",
          "不适合把完全未知的产品方向全丢给它去猜，需求不清时先做人来定目标。",
        ],
        bodyEn: [
          "Codex fits multi-file engineering tasks that depend on repository context and verification.",
          "It is weaker when the product goal itself is still undefined.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "上下文优先：先读代码，再行动。仓库结构、已有模式、历史实现会直接影响修改质量。",
          "增量实现：大改动要切片推进，每一步都保持可构建、可验证。",
          "验证闭环：改完必须跑 lint、test、build 或最小可用验证，不然只是生成代码，不算完成任务。",
        ],
        bodyEn: [
          "Repository context, incremental delivery, and verification loops are core to effective Codex use.",
          "Code generation without validation is not task completion.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "先明确目标和边界，再搜索相关文件，读关键实现，决定修改切片，落代码，跑验证，最后输出变更说明。",
          "如果任务很大，应该先写 spec 或 plan，再进入实现；如果任务很小，直接落代码通常更高效。",
        ],
        bodyEn: [
          "A typical flow is goal clarification, repository search, focused reading, sliced implementation, validation, and reporting.",
          "Larger changes benefit from specs or plans before code edits.",
        ],
      },
      {
        titleZh: "常用能力 / 习惯",
        titleEn: "Useful Habits",
        bodyZh: [
          "优先让它读本地代码，而不是凭记忆回答。",
          "让它输出文件路径、验证结果、风险点和剩余问题，这比一段泛泛而谈的解释更有用。",
          "涉及生产部署、数据库、权限、支付等高风险部分时，要明确要求它先做现状检查。",
        ],
        bodyEn: [
          "Prefer repository-grounded answers over recall-based ones.",
          "Ask for file references, validation results, risks, and remaining gaps.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是让它先给方案但不让它动手，最后变成反复讨论而没有产出。",
          "误区二是默认它知道你的业务边界。实际上，业务约束、不可动文件、部署方式都需要明确。",
          "误区三是让它一次写太大范围的改动，不给中间验证点，这样最容易在后面返工。",
        ],
        bodyEn: [
          "Long discussion without execution loses momentum.",
          "Unstated business constraints lead to weak results.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先用它做读代码、解释模块、补测试、修小 bug，再逐步把它放进更大的重构和交付流程。",
          "如果项目进入上线阶段，要让它同时关注构建、配置、脚本、回滚路径和文档，不要只盯前端页面。",
        ],
        bodyEn: [
          "Start with explanation, testing, and small fixes before moving to broader delivery tasks.",
          "During launch work, treat build, config, rollback, and docs as first-class outputs.",
        ],
      },
    ],
  },
  {
    slug: "claude-code",
    parentSlug: null,
    sortOrder: 40,
    titleZh: "Claude Code",
    titleEn: "Claude Code",
    summaryZh: "围绕代码协作、任务收敛和结果验证来用 Claude Code，而不是只把它当成对话模型。",
    summaryEn: "Use Claude Code around code collaboration, task closure, and result verification instead of pure conversation.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Claude Code 适合和代码仓库绑定使用，通过读取文件、定位上下文、解释逻辑和输出修改建议参与开发。",
          "它更像一个能持续跟进任务的协作位，而不是只回答一个问题就结束。",
        ],
        bodyEn: [
          "Claude Code works best as a repository-aware engineering collaborator.",
          "It is more useful as an ongoing task partner than as a one-shot assistant.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合帮助你理解陌生代码、生成结构化修改建议、补测试、梳理 PR 风险和做多轮修正。",
          "如果你只是想快速查一个命令或看一个固定 API，用普通文档和搜索可能更快。",
        ],
        bodyEn: [
          "It is strong at understanding unfamiliar code, structuring edits, and iterating on changes.",
          "For trivial reference lookups, plain docs are often faster.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "上下文窗口不是无限的，所以任务拆分仍然重要。不要把整个项目一次塞进去，要让上下文围绕当前目标组织。",
          "好的交互不是更长的 prompt，而是更明确的边界、输出格式和验收标准。",
        ],
        bodyEn: [
          "Context still needs curation even when the model is strong.",
          "Clear scope and acceptance criteria beat longer prompts.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见用法是先让它搜索实现位置，再解释关键文件，再决定是否改动，最后根据测试或构建结果继续修正。",
          "对大型任务，先让它输出切片计划，再逐个完成切片，会比一次性全改更稳。",
        ],
        bodyEn: [
          "A common flow is search, explain, decide, implement, validate, then iterate.",
          "Large tasks benefit from sliced execution.",
        ],
      },
      {
        titleZh: "常用能力 / 习惯",
        titleEn: "Useful Habits",
        bodyZh: [
          "让它引用具体文件和行号，这样你能快速判断建议是否靠谱。",
          "让它在输出里区分事实、推断和未验证项，不然内容看起来完整，但可执行性很差。",
        ],
        bodyEn: [
          "Ask for file and line references to keep suggestions auditable.",
          "Separate facts, inference, and unverified assumptions.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把它当成替代工程判断的工具。模型能加速执行，但不能替你承担系统设计责任。",
          "误区二是没有验证环节。任何涉及代码、配置、部署的建议，都应该经过运行结果证明。",
        ],
        bodyEn: [
          "Models do not replace engineering judgment.",
          "Unverified suggestions are not finished work.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先从小范围任务练习，比如修一个页面、补一段测试、解释一个模块，再过渡到跨模块任务。",
          "长期来看，真正要练的是如何提边界、如何验证结果、如何把模型能力接进团队流程。",
        ],
        bodyEn: [
          "Start with narrow tasks before moving to cross-module work.",
          "The real skill is integrating model help into a disciplined engineering workflow.",
        ],
      },
    ],
  },
  {
    slug: "opencode",
    parentSlug: null,
    sortOrder: 50,
    titleZh: "OpenCode",
    titleEn: "OpenCode",
    summaryZh: "从开源编码助手和开放工作流的角度看 OpenCode，重点不是名称，而是它的接入方式和可控性。",
    summaryEn: "View OpenCode through the lens of open coding assistants, extensibility, and controllable workflows.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "OpenCode 可以理解为一类更开放的编码协作方式，强调模型能力、工具接入、扩展性和本地工作流之间的结合。",
          "和封闭产品相比，它更适合对可扩展性、可替换性和自定义链路有要求的开发者。",
        ],
        bodyEn: [
          "OpenCode emphasizes extensible model-assisted coding with open integrations and local workflows.",
          "It suits developers who care about replaceable components and custom orchestration.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合你希望把模型能力接入已有脚本、CLI、编辑器、私有服务，或者希望自己定义工具调用方式的场景。",
          "如果你的需求只是用现成产品写代码，不一定非要走开放路线。",
        ],
        bodyEn: [
          "It fits cases where model assistance must integrate with your own scripts, CLI, or services.",
          "If you only need a turnkey product, full openness may be unnecessary.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "开放并不等于复杂，而是让模型、提示、工具、数据源和执行器都可以替换和编排。",
          "真正重要的是接口边界：输入是什么、输出是什么、哪些工具可调用、失败后怎么恢复。",
        ],
        bodyEn: [
          "Openness means replaceable pieces and explicit interfaces.",
          "The main design question is how contracts, tools, and recovery are defined.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见用法是把模型嵌进本地命令行、编辑器插件、自动化脚本或构建系统里，让模型成为流程的一环，而不是单独存在。",
          "如果同时有多个模型或多个工具，就要做路由和降级策略，不要让系统对单一供应商强耦合。",
        ],
        bodyEn: [
          "A common pattern is embedding model assistance into local CLI, editors, or automation scripts.",
          "Multi-provider routing and fallback matter when production reliability is required.",
        ],
      },
      {
        titleZh: "常用能力 / 关注点",
        titleEn: "Key Considerations",
        bodyZh: [
          "重点看四件事：接口契约、权限边界、日志可追踪、模型替换成本。",
          "如果工具链一换模型就全部失效，说明设计没有真正模块化。",
        ],
        bodyEn: [
          "Focus on contracts, permissions, logging, and provider swap cost.",
          "A fragile provider dependency means the system is not truly modular.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是追求开放而忽略交付。开放性是手段，不是目标。",
          "误区二是过早抽象。很多时候先做一条能跑通的链路，比一开始就建完整框架更实际。",
        ],
        bodyEn: [
          "Openness should serve delivery, not replace it.",
          "Over-abstraction too early slows down real progress.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先做单一模型、单一工具的最小链路，再增加模型路由、可配置 prompt、工具注册和权限控制。",
          "如果目标是商用系统，要先考虑监控、审计和调用成本，而不是只看能不能跑。",
        ],
        bodyEn: [
          "Build a minimal single-model, single-tool path first.",
          "Commercial systems need observability, auditability, and cost controls early.",
        ],
      },
    ],
  },
  {
    slug: "skills",
    parentSlug: null,
    sortOrder: 60,
    titleZh: "Skills（技能）",
    titleEn: "Skills",
    summaryZh: "把重复有效的提示方式、任务流程和工具规则沉淀成可复用能力，而不是每次都从零组织。",
    summaryEn: "Turn repeated prompt patterns, task flows, and tool rules into reusable skills.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Skills 可以理解为给模型准备的稳定工作说明书，里面通常包含使用场景、步骤、边界、风格、工具限制和验证要求。",
          "它的目标是降低重复沟通成本，让同类任务在不同时间、不同人使用时都能更稳定。",
        ],
        bodyEn: [
          "Skills act like reusable operating instructions for model-assisted tasks.",
          "They reduce repeated coordination and improve consistency across similar work.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合那些会反复发生、步骤相对固定、但仍然需要模型理解上下文的任务，例如代码评审、部署检查、文档整理、接口设计。",
          "一次性临时任务没必要专门做 skill，成本回收不回来。",
        ],
        bodyEn: [
          "Skills fit repeatable tasks with stable steps but context-sensitive execution.",
          "One-off tasks usually do not justify the setup cost.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "技能不是提示词堆砌，而是流程、边界和质量要求的组合。",
          "一个好的 skill 要说清楚什么时候该用、什么时候别用、先做什么、后做什么、做完怎么验收。",
        ],
        bodyEn: [
          "A skill is more than a prompt; it is a workflow and quality contract.",
          "Good skills define when to use them, sequence, boundaries, and validation.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "通常先观察高频任务，再抽取稳定模式，写成 skill 文档，然后通过真实任务不断修正。",
          "如果 skill 太宽泛，会回到通用废话；如果太窄，只能服务单一任务，复用价值也很低。",
        ],
        bodyEn: [
          "A common path is observing recurring work, extracting stable patterns, then iterating from real usage.",
          "Skills that are too broad or too narrow both lose value.",
        ],
      },
      {
        titleZh: "常用组成",
        titleEn: "Common Structure",
        bodyZh: [
          "常见组成包括：适用场景、禁用场景、默认流程、工具使用规则、输出格式、风险提示、验证清单。",
          "如果 skill 里没有验证要求，最终很容易只剩格式统一，质量却不稳定。",
        ],
        bodyEn: [
          "Skills often include scope, exclusions, workflow, tool rules, output format, risk notes, and verification steps.",
          "Without verification criteria, consistency becomes cosmetic rather than substantive.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把所有任务都试图抽象成 skill，结果系统复杂度越来越高，真正执行效率反而下降。",
          "误区二是 skill 写出来后不维护。实际流程变了、工具变了、代码库变了，skill 也要跟着更新。",
        ],
        bodyEn: [
          "Not every task needs a skill.",
          "Skills must evolve when tools, repositories, or workflows change.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先从一个最常做的任务开始，例如代码评审或部署检查，把它沉淀成第一份 skill。",
          "等你确认 skill 真能稳定提升质量，再扩展到更多工作流，不要一上来就建一大套体系。",
        ],
        bodyEn: [
          "Start with the single most repeated task, then expand only after proven value.",
          "A small, effective skill set beats a large, neglected one.",
        ],
      },
    ],
  },
  {
    slug: "ollama",
    parentSlug: null,
    sortOrder: 70,
    titleZh: "学习 Ollama",
    titleEn: "Learn Ollama",
    summaryZh: "围绕本地模型运行、模型管理和私有化调试来理解 Ollama，重点看它在开发工作流里的位置。",
    summaryEn: "Understand Ollama through local model execution, model management, and private development workflows.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Ollama 是本地运行大模型的一个常用入口，目标是让你在本机或自有服务器上更方便地下载、管理和调用模型。",
          "它不是训练框架，而是模型运行与调用层，更适合做推理实验、私有部署和接口联调。",
        ],
        bodyEn: [
          "Ollama is a local model runtime and model management entry point.",
          "It focuses on inference and development workflows rather than model training.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合离线测试、内网开发、敏感数据不方便出网、想快速比较多个本地模型效果的场景。",
          "如果你需要的是高并发公网服务，Ollama 只是方案的一部分，还要配合队列、鉴权、监控和负载管理。",
        ],
        bodyEn: [
          "It fits offline experiments, private environments, and local model comparison.",
          "Public high-concurrency services still need broader infrastructure around it.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "模型拉取：把本地运行需要的模型权重和配置准备好。",
          "模型标签：同一个模型可以有不同量化版本，性能、显存占用和效果会不同。",
          "本地接口：很多项目是通过 Ollama 提供的 HTTP 接口把模型接进应用。",
        ],
        bodyEn: [
          "Model pulls, model variants, and local inference APIs are the core concepts.",
          "Different quantization levels trade quality for memory and speed.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：安装 Ollama -> 拉取模型 -> 本地对话测试 -> 通过 API 接入脚本或应用 -> 观察延迟、显存和输出质量。",
          "如果你要做桌面工具或私有服务，可以先本地验证，再迁到自己的服务器环境。",
        ],
        bodyEn: [
          "A typical flow is install, pull models, test locally, integrate via API, then measure quality and latency.",
          "Private apps often start locally before moving to a controlled server environment.",
        ],
      },
      {
        titleZh: "常用工具 / 命令 / 关注点",
        titleEn: "Commands and Considerations",
        bodyZh: [
          "常见关注点包括：模型体积、显存占用、CPU 还是 GPU 推理、上下文长度、并发能力和模型启动速度。",
          "本地跑得动不代表线上也合适，线上要额外看多用户竞争资源后的表现。",
        ],
        bodyEn: [
          "Model size, memory, GPU usage, context length, and cold-start behavior matter most.",
          "Local success does not guarantee production suitability.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把本地体验等同于真实服务能力。真正上线时，并发、队列、鉴权和观测能力才是难点。",
          "误区二是盲目追求大模型。很多业务在本地小模型上验证思路更快、更便宜。",
        ],
        bodyEn: [
          "Local inference quality is not the same as service readiness.",
          "Bigger models are not always better for early product validation.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学会安装、拉模型、跑接口，再看如何把它接进桌面端、脚本或私有服务。",
          "如果后面要做商用系统，建议尽早测试模型冷启动、长上下文、资源竞争和失败恢复策略。",
        ],
        bodyEn: [
          "Start with installation, model pulls, and API calls.",
          "Commercial use demands early testing of cold starts, long context, contention, and recovery.",
        ],
      },
    ],
  },
  {
    slug: "tensorflow",
    parentSlug: null,
    sortOrder: 80,
    titleZh: "学习 TensorFlow",
    titleEn: "Learn TensorFlow",
    summaryZh: "从深度学习建模、训练和部署链路理解 TensorFlow，重点看它在工程体系里的角色。",
    summaryEn: "Understand TensorFlow through deep learning modeling, training, and deployment workflows.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "TensorFlow 是深度学习框架，适合做模型构建、训练、推理和部署。",
          "它既能用于研究，也能用于生产系统，但学习曲线相对更偏工程化。",
        ],
        bodyEn: [
          "TensorFlow is a deep learning framework for model building, training, inference, and deployment.",
          "It serves both research and production, with a strong engineering orientation.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合图像、语音、文本、时序预测等需要深度神经网络建模的任务。",
          "如果问题用传统特征和经典模型就能解决，不一定需要 TensorFlow。",
        ],
        bodyEn: [
          "It fits vision, speech, text, and time-series problems that need neural networks.",
          "Classical ML may still be enough for simpler structured tasks.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "张量是数据的基础表示，计算图描述运算过程，训练循环负责前向、反向和参数更新。",
          "Keras 是 TensorFlow 里最常用的高层接口，能让建模速度更快。",
        ],
        bodyEn: [
          "Tensors, computation graphs, and training loops are the core concepts.",
          "Keras is the most common high-level API in TensorFlow workflows.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "通常先准备数据集，再定义模型，再配置损失函数和优化器，最后训练、评估、保存和部署。",
          "上线前除了看精度，还要看模型大小、推理时延、资源占用和兼容性。",
        ],
        bodyEn: [
          "A standard path is data preparation, model definition, loss/optimizer setup, training, evaluation, and deployment.",
          "Production readiness also depends on size, latency, and compatibility.",
        ],
      },
      {
        titleZh: "常用工具 / 生态",
        titleEn: "Tools and Ecosystem",
        bodyZh: [
          "常见生态包括 Keras、TensorBoard、TF Serving、TFLite。不同工具分别面向训练可视化、服务部署和边端运行。",
          "如果你后面要做移动端或嵌入式推理，TensorFlow 生态会更有优势。",
        ],
        bodyEn: [
          "Keras, TensorBoard, TF Serving, and TFLite are common TensorFlow ecosystem tools.",
          "TensorFlow has strong paths for mobile and edge deployment.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是只关心训练能不能收敛，不关注推理部署。",
          "误区二是拿深度学习解决并不需要深度学习的问题，结果成本高、效果一般、可维护性也差。",
        ],
        bodyEn: [
          "Training success alone is not the same as deployable success.",
          "Deep learning should not be forced onto every problem.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先用 Keras 熟悉基础建模，再逐步理解数据管道、训练控制、性能调优和部署方式。",
          "如果目标是业务落地，建议尽早学会保存模型、导出模型和部署模型，而不是只停留在 notebook。",
        ],
        bodyEn: [
          "Start with Keras, then move into pipelines, training control, optimization, and deployment.",
          "Deployment literacy matters early if the goal is product delivery.",
        ],
      },
    ],
  },
  {
    slug: "pytorch",
    parentSlug: null,
    sortOrder: 90,
    titleZh: "学习 PyTorch",
    titleEn: "Learn PyTorch",
    summaryZh: "从动态图建模、训练循环和实验效率来理解 PyTorch，重点是它在研究和应用之间的平衡。",
    summaryEn: "Understand PyTorch through dynamic graph modeling, training loops, and practical experimentation.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "PyTorch 是目前非常主流的深度学习框架，特点是动态图风格强、调试体验好、社区活跃。",
          "很多研究项目、开源模型和推理库都会优先给出 PyTorch 版本。",
        ],
        bodyEn: [
          "PyTorch is a dominant deep learning framework with strong dynamic graph and debugging ergonomics.",
          "Many research and open-source model releases prioritize PyTorch.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合计算机视觉、NLP、生成模型、强化学习等需要灵活建模与快速实验迭代的任务。",
          "如果你经常需要改网络结构、调训练循环、验证新想法，PyTorch 通常会更顺手。",
        ],
        bodyEn: [
          "It fits vision, NLP, generative modeling, and other experimentation-heavy workloads.",
          "PyTorch is especially comfortable when architecture and training logic change often.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "核心是张量、自动求导、模块化模型和训练循环。模型一般通过 `nn.Module` 组织，训练时配合损失函数和优化器更新参数。",
          "PyTorch 学习的关键不是 API 背诵，而是弄懂前向传播、反向传播和 batch 训练在代码里怎么连起来。",
        ],
        bodyEn: [
          "Tensors, autograd, modules, and training loops are the main PyTorch concepts.",
          "Understanding how forward, backward, and optimization connect is more important than memorizing APIs.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：准备 Dataset 和 DataLoader -> 定义模型 -> 训练 -> 验证 -> 保存权重 -> 推理或部署。",
          "做实验时最好同时记录超参数、数据版本、指标和权重文件，不然结果很难复现。",
        ],
        bodyEn: [
          "A standard path is Dataset/DataLoader setup, model definition, training, validation, saving, and inference.",
          "Tracking configs and artifacts is essential for reproducibility.",
        ],
      },
      {
        titleZh: "常用工具 / 生态",
        titleEn: "Tools and Ecosystem",
        bodyZh: [
          "常见生态包括 TorchVision、TorchAudio、Transformers、Lightning、Accelerate 等。",
          "很多大模型和多模态项目也会围绕 PyTorch 做训练与推理封装，所以它的生态价值很高。",
        ],
        bodyEn: [
          "TorchVision, TorchAudio, Transformers, Lightning, and Accelerate are common ecosystem pieces.",
          "PyTorch also anchors a large share of modern open model tooling.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是模型能跑就行，不关注数据清洗和评估设计。很多效果问题其实不在模型结构本身。",
          "误区二是实验很多，但记录很乱。模型训练没有良好记录，后面几乎无法比较和复现。",
        ],
        bodyEn: [
          "Model code alone does not guarantee useful outcomes.",
          "Poor experiment tracking destroys repeatability.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先用一个小任务跑通完整训练循环，再逐步学 GPU、混合精度、分布式训练和模型导出。",
          "如果目标是工程落地，建议尽早区分研究代码、训练代码和推理服务代码。",
        ],
        bodyEn: [
          "Start with a complete small training loop, then expand to performance and deployment topics.",
          "Separate research, training, and serving concerns early in real projects.",
        ],
      },
    ],
  },
  {
    slug: "scikit-learn",
    parentSlug: null,
    sortOrder: 100,
    titleZh: "学习 Scikit-learn",
    titleEn: "Learn Scikit-learn",
    summaryZh: "从经典机器学习建模、特征处理和评估流程理解 Scikit-learn，重点看它在结构化数据场景的价值。",
    summaryEn: "Understand Scikit-learn through classical modeling, feature handling, and evaluation for structured data.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Scikit-learn 是 Python 里最常用的传统机器学习工具库，覆盖分类、回归、聚类、降维、评估和预处理。",
          "它特别适合表格数据和中小规模实验，是很多建模项目的第一站。",
        ],
        bodyEn: [
          "Scikit-learn is a standard Python toolkit for classical machine learning.",
          "It is especially effective for tabular data and medium-scale experiments.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合用户画像、风控评分、销量预测、异常检测、文本向量化后的分类等结构化任务。",
          "如果数据规模没有大到需要深度学习，Scikit-learn 往往更简单、更快、更容易解释。",
        ],
        bodyEn: [
          "It fits scoring, forecasting, anomaly detection, and structured classification tasks.",
          "When deep learning is unnecessary, it is often simpler and easier to interpret.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "核心是数据集切分、特征工程、模型训练、验证评估和参数搜索。",
          "Scikit-learn 的统一接口很重要：大部分模型都有 `fit`、`predict`、`score` 这类一致方法，便于替换和比较。",
        ],
        bodyEn: [
          "Dataset splitting, feature engineering, training, and evaluation are the main concepts.",
          "The unified estimator interface makes model comparison practical.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "一般先做数据清洗，再划分训练集和验证集，然后做特征处理，训练多个模型，比较指标，最后保存最佳方案。",
          "如果上线使用，最好把预处理和模型一起封装，不要线上线下两套逻辑分开写。",
        ],
        bodyEn: [
          "A normal flow is cleaning, splitting, feature processing, model comparison, and model persistence.",
          "Preprocessing and model logic should be packaged together for production consistency.",
        ],
      },
      {
        titleZh: "常用工具 / 模型",
        titleEn: "Common Tools and Models",
        bodyZh: [
          "常用模型包括线性回归、逻辑回归、决策树、随机森林、SVM、KNN、朴素贝叶斯、KMeans。",
          "常用工具包括 Pipeline、StandardScaler、OneHotEncoder、GridSearchCV、cross_val_score。",
        ],
        bodyEn: [
          "Common models include regression, trees, forests, SVM, KNN, and Naive Bayes.",
          "Pipelines, encoders, scalers, and search utilities are core productivity tools.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是只调模型不处理特征。很多时候特征工程比换模型更有效。",
          "误区二是数据泄漏，例如在全量数据上先做标准化再切分，会导致评估结果虚高。",
        ],
        bodyEn: [
          "Feature engineering often matters more than endless model swapping.",
          "Data leakage can make offline metrics meaningless.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学数据切分、分类回归、Pipeline 和交叉验证，再看模型调参和集成方法。",
          "真实项目里不要只追求一个最高分，要同时看解释性、稳定性、训练成本和维护难度。",
        ],
        bodyEn: [
          "Start with splitting, supervised learning, pipelines, and cross-validation.",
          "In production, balance score with interpretability, stability, and maintenance cost.",
        ],
      },
    ],
  },
  {
    slug: "machine-learning",
    parentSlug: null,
    sortOrder: 110,
    titleZh: "机器学习",
    titleEn: "Machine Learning",
    summaryZh: "从问题建模、特征工程、评估指标和上线约束整体理解机器学习，而不是只记算法名字。",
    summaryEn: "Understand machine learning through problem framing, features, metrics, and deployment constraints.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "机器学习的本质是让系统从数据中学习规律，再把规律用于预测、分类、排序或决策。",
          "它不是某一个框架，也不是某一个算法，而是一整套从数据到模型再到应用的工程过程。",
        ],
        bodyEn: [
          "Machine learning is about learning patterns from data for prediction, classification, ranking, or decision support.",
          "It is an end-to-end process, not a single algorithm or framework.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合难以手写规则、但又有大量历史数据可利用的问题，例如推荐、风控、预测、质量检测、用户行为分析。",
          "没有足够可用数据时，机器学习通常不会神奇地替你补上业务理解。",
        ],
        bodyEn: [
          "It fits problems where rules are hard to hand-code but useful historical data exists.",
          "Without reliable data, ML cannot replace missing business understanding.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "监督学习依赖带标签数据，无监督学习更多做聚类和结构发现，强化学习关注决策过程中的反馈优化。",
          "特征决定模型看见什么，标签决定模型学什么，指标决定你如何判断它是否真的有用。",
        ],
        bodyEn: [
          "Supervised, unsupervised, and reinforcement learning address different problem settings.",
          "Features, labels, and metrics define what the model sees, learns, and is judged by.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "标准流程是：定义问题 -> 准备数据 -> 选特征 -> 训练模型 -> 评估 -> 上线 -> 监控 -> 迭代。",
          "很多项目失败不是算法差，而是前面的问题定义不清、后面的监控没做。",
        ],
        bodyEn: [
          "Problem framing, data prep, features, training, evaluation, deployment, monitoring, and iteration form the core workflow.",
          "Weak framing and weak monitoring break more projects than weak algorithms.",
        ],
      },
      {
        titleZh: "常用方法 / 指标",
        titleEn: "Common Methods and Metrics",
        bodyZh: [
          "分类常看准确率、召回率、F1、AUC；回归常看 MAE、MSE、RMSE；排序和推荐会看点击率、转化率、NDCG 等。",
          "选择指标要跟业务目标一致，不能离线高分、线上没价值。",
        ],
        bodyEn: [
          "Metrics differ across classification, regression, ranking, and recommendation tasks.",
          "Metric choice must align with business impact.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把模型效果等同于业务效果。模型分数高，不代表上线一定能提升转化或效率。",
          "误区二是忽略数据分布变化。训练集和真实线上用户行为不一致时，模型很快就会失效。",
        ],
        bodyEn: [
          "Model score is not the same as business value.",
          "Distribution drift can invalidate a once-good model quickly.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学监督学习、特征工程、交叉验证和指标，再逐步扩展到集成方法、深度学习和线上服务化。",
          "真正做项目时，建议先用简单模型建立基线，再决定是否需要更复杂的方法。",
        ],
        bodyEn: [
          "Start with supervised learning, features, validation, and metrics.",
          "Build a strong simple baseline before escalating to more complex models.",
        ],
      },
    ],
  },
  {
    slug: "langchain",
    parentSlug: null,
    sortOrder: 120,
    titleZh: "LangChain",
    titleEn: "LangChain",
    summaryZh: "把 LangChain 看成应用编排层，用来组织模型、提示、工具和状态，而不是把业务复杂度都压进框架。",
    summaryEn: "Treat LangChain as an application orchestration layer for models, prompts, tools, and state.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "LangChain 的定位不是替你解决业务本身，而是帮你把模型调用、Prompt、工具接入、检索和链路组织起来。",
          "它更适合用在需要多组件协同的 AI 应用里，而不是单纯一个接口调用。",
        ],
        bodyEn: [
          "LangChain helps organize model calls, prompts, tools, retrieval, and flow control.",
          "It is most useful for multi-component AI applications rather than single API calls.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合 RAG、工具调用、对话状态管理、多步骤生成和智能体编排等场景。",
          "如果你的系统只是把用户输入发给模型再返回结果，LangChain 可能会显得偏重。",
        ],
        bodyEn: [
          "It fits RAG, tool use, conversation state, and multi-step generation workflows.",
          "For a plain pass-through LLM endpoint, it may be heavier than needed.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "Prompt Template 负责组织输入，Chain 负责定义步骤顺序，Retriever 负责找知识，Tool 负责接外部能力。",
          "后续如果进入更复杂的状态流，通常会转向更显式的图结构编排，比如 LangGraph。",
        ],
        bodyEn: [
          "Prompt templates, chains, retrievers, and tools are the main concepts.",
          "More explicit graph-based orchestration becomes important as workflows grow more stateful.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：整理输入 -> 构造 prompt -> 检索资料 -> 拼接上下文 -> 模型输出 -> 结果解析或回写。",
          "如果再加工具调用，就会多出参数构造、权限判断和异常恢复环节。",
        ],
        bodyEn: [
          "A common flow is input shaping, prompt building, retrieval, context assembly, model output, and result parsing.",
          "Tool use adds permission checks, parameter construction, and recovery logic.",
        ],
      },
      {
        titleZh: "常用能力 / 生态",
        titleEn: "Common Capabilities",
        bodyZh: [
          "LangChain 常见能力包括文档切分、向量检索接入、对话记忆、工具包装和输出结构化。",
          "真正上线时，很多团队会保留 LangChain 的便利层，同时把关键业务逻辑独立封装，避免深度耦合。",
        ],
        bodyEn: [
          "Document splitting, retrieval integration, memory, tool wrapping, and output structuring are common capabilities.",
          "Production systems often keep core business logic outside the framework.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是用框架掩盖业务设计问题。流程不清、状态不清，换任何框架都一样乱。",
          "误区二是所有逻辑都塞进链条里，后面一旦调试或替换组件会很痛苦。",
        ],
        bodyEn: [
          "Frameworks do not rescue weak workflow design.",
          "Overloading chains with all business logic hurts maintainability.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学 Prompt、Retriever、Tool 三个最关键的模块，再学复杂链路和状态编排。",
          "实战时建议把模型调用层、业务规则层、持久化层分开，LangChain 只负责中间的组织工作。",
        ],
        bodyEn: [
          "Start with prompts, retrievers, and tools before moving into advanced orchestration.",
          "Keep framework orchestration separate from business rules and persistence.",
        ],
      },
    ],
  },
  {
    slug: "nlp",
    parentSlug: null,
    sortOrder: 130,
    titleZh: "自然语言处理 NLP",
    titleEn: "NLP",
    summaryZh: "从文本理解、抽取、分类、检索和生成链路整体认识 NLP，而不是只把它等同于聊天模型。",
    summaryEn: "Understand NLP as the broader field of text understanding, extraction, classification, retrieval, and generation.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "自然语言处理关注的是让机器理解、处理和生成人类语言，包括分词、分类、实体抽取、检索、翻译、摘要和生成等任务。",
          "生成式大模型很热门，但它只是 NLP 发展到当前阶段的一部分，不代表全部。",
        ],
        bodyEn: [
          "NLP covers text understanding, extraction, retrieval, translation, summarization, and generation.",
          "Generative models are a major part of NLP today, but not the whole field.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合处理客服文本、评论分析、知识问答、文本审核、合同抽取、搜索增强、自动摘要等语言相关业务。",
          "只要输入和输出主要是文字，很多问题都可以先从 NLP 视角拆解。",
        ],
        bodyEn: [
          "NLP fits customer support text, sentiment, QA, moderation, extraction, search, and summarization.",
          "Text-heavy workflows often benefit from an NLP framing first.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "文本表示是核心问题。传统做法会用词袋、TF-IDF、词向量，现代做法更多用 Transformer 编码和向量语义表示。",
          "另一个核心是任务定义：是分类、抽取、排序，还是生成，不同任务的建模方法完全不同。",
        ],
        bodyEn: [
          "Text representation and task definition sit at the center of NLP.",
          "Different tasks require different modeling strategies.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：清洗文本 -> 分词或编码 -> 建立表示 -> 训练或调用模型 -> 输出结果 -> 做规则修正或人工校验。",
          "如果是 RAG 系统，还会多出切分文档、建立索引、检索召回和结果融合这几步。",
        ],
        bodyEn: [
          "Common flows include cleaning, encoding, modeling, output generation, and post-processing.",
          "RAG adds document splitting, indexing, retrieval, and answer synthesis.",
        ],
      },
      {
        titleZh: "常用任务 / 工具",
        titleEn: "Common Tasks and Tools",
        bodyZh: [
          "常见任务包括文本分类、情感分析、关键词提取、命名实体识别、向量检索、问答和文本生成。",
          "常见工具和生态包括 Hugging Face、spaCy、NLTK、Transformers、Sentence Transformers 等。",
        ],
        bodyEn: [
          "Text classification, sentiment, entity extraction, vector search, QA, and generation are common NLP tasks.",
          "Hugging Face and related tooling dominate many modern NLP workflows.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是把所有文本问题都当生成问题。很多任务用分类或抽取更稳、更便宜。",
          "误区二是忽略领域词汇和数据清洗。行业术语一多，通用模型效果可能会明显下降。",
        ],
        bodyEn: [
          "Not every text task should be solved with generation.",
          "Domain terminology and data cleanliness matter a lot in NLP quality.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学文本预处理、分类、抽取和向量检索，再扩展到生成式应用和多轮问答系统。",
          "项目落地时，建议明确区分离线处理链路和在线交互链路，两者的性能要求不同。",
        ],
        bodyEn: [
          "Start with preprocessing, classification, extraction, and retrieval before moving into generation.",
          "Separate offline text processing from online interaction paths in production systems.",
        ],
      },
    ],
  },
  {
    slug: "opencv",
    parentSlug: null,
    sortOrder: 140,
    titleZh: "学习 OpenCV",
    titleEn: "Learn OpenCV",
    summaryZh: "围绕图像处理、视觉前置流程和自动化识别理解 OpenCV，重点看它在工程中的实用价值。",
    summaryEn: "Understand OpenCV through image processing, visual preprocessing, and practical automation tasks.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "OpenCV 是计算机视觉和图像处理领域非常常用的工具库，适合做图像读写、几何变换、滤波、阈值、轮廓分析、特征提取等工作。",
          "很多视觉任务在进入深度学习模型之前，都会先经过 OpenCV 做预处理。",
        ],
        bodyEn: [
          "OpenCV is a standard toolkit for vision preprocessing and image operations.",
          "Many pipelines use it before any deep learning stage.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合做截图分析、图像裁剪、模板匹配、颜色识别、二维码处理、OCR 前处理和轻量视觉自动化。",
          "如果任务只是读取几张图片并简单变换，OpenCV 通常就够用，不一定需要复杂模型。",
        ],
        bodyEn: [
          "It fits screenshot analysis, cropping, template matching, OCR preprocessing, and lightweight automation.",
          "Simple image operations often do not need heavier vision models.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "图像本质上是矩阵，很多 OpenCV 操作都在围绕像素矩阵的变化进行。",
          "颜色空间、阈值、边缘、轮廓、特征点这些概念决定了你如何从图像里提取可用信息。",
        ],
        bodyEn: [
          "Images are matrices, and many OpenCV operations are matrix transformations.",
          "Color spaces, thresholds, edges, contours, and feature points are core concepts.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：读取图片 -> 灰度化或转颜色空间 -> 去噪 -> 阈值化 -> 轮廓或目标定位 -> 输出结果。",
          "如果接自动化系统，后面还可能加点击位置计算、区域裁剪和结果回传。",
        ],
        bodyEn: [
          "A common flow is read, transform, denoise, threshold, detect, and emit results.",
          "Automation scenarios may continue with coordinate mapping and action execution.",
        ],
      },
      {
        titleZh: "常用能力 / 方法",
        titleEn: "Common Techniques",
        bodyZh: [
          "常用能力包括尺寸缩放、旋转、透视变换、边缘检测、模板匹配、轮廓检测和图像拼接。",
          "工程上很多任务并不追求最先进，而是追求可复现、速度快、资源占用低。",
        ],
        bodyEn: [
          "Resize, rotate, perspective transform, edge detection, contour detection, and template matching are common techniques.",
          "Engineering value often comes from speed and reliability rather than novelty.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是直接把复杂图像任务全交给模板匹配，忽略角度、尺寸、光照变化。",
          "误区二是视觉链路没有中间调试输出，最后识别错了也不知道是哪一步出了问题。",
        ],
        bodyEn: [
          "Template matching alone is fragile under changing scale, angle, and lighting.",
          "Without intermediate debug outputs, visual pipelines become hard to troubleshoot.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先把图像读写、裁剪、颜色空间、阈值、轮廓这些最常见操作学熟，再扩展到视频流和复杂视觉任务。",
          "如果目标是自动化项目，建议从一张固定模板图开始验证，再逐步增强健壮性。",
        ],
        bodyEn: [
          "Start with I/O, cropping, color spaces, thresholding, and contours before advancing further.",
          "For automation, begin with a fixed template scenario and then harden it incrementally.",
        ],
      },
    ],
  },
  {
    slug: "selenium",
    parentSlug: null,
    sortOrder: 150,
    titleZh: "学习 Selenium",
    titleEn: "Learn Selenium",
    summaryZh: "从浏览器自动化、表单操作、抓取和回归测试理解 Selenium，重点看它在传统自动化里的定位。",
    summaryEn: "Understand Selenium through browser automation, form handling, scraping, and regression testing.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Selenium 是经典浏览器自动化工具，能驱动真实浏览器完成打开页面、点击、输入、等待、抓取和断言等动作。",
          "它适合跨站点自动化、老项目兼容和传统 Web 测试链路。",
        ],
        bodyEn: [
          "Selenium is a classic browser automation toolkit for real browser control.",
          "It is useful for traditional web testing and broad compatibility scenarios.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合表单自动化、后台管理操作、流程回归测试、页面抓取和兼容性验证。",
          "如果你需要的是现代前端更强的测试调试体验，也可以同时比较 Playwright。",
        ],
        bodyEn: [
          "It fits form automation, admin flows, regression testing, and scraping.",
          "Playwright may offer a stronger modern testing experience for newer stacks.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "核心是 WebDriver、元素定位、显式等待、窗口与 iframe 切换、异常处理和结果断言。",
          "真正决定稳定性的往往不是脚本写了多少，而是定位方式和等待策略是否合理。",
        ],
        bodyEn: [
          "WebDriver, locators, explicit waits, frame switching, error handling, and assertions are the basics.",
          "Stability usually depends more on locators and wait strategy than on script length.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：启动浏览器 -> 打开页面 -> 登录 -> 定位元素 -> 执行动作 -> 等待结果 -> 断言页面状态。",
          "抓取任务则通常会在结果页提取数据，并在异常时做重试或截图保留。",
        ],
        bodyEn: [
          "A common flow is launch, navigate, authenticate, locate, act, wait, and assert.",
          "Scraping flows often add extraction, retries, and screenshots for failure handling.",
        ],
      },
      {
        titleZh: "常用能力 / 关注点",
        titleEn: "Capabilities and Focus",
        bodyZh: [
          "重点关注 XPath/CSS 定位、显式等待、文件上传下载、弹窗处理、截图和日志。",
          "如果流程需要长期运行，建议给每一步保留可追踪日志，不要失败了只看到一个超时。",
        ],
        bodyEn: [
          "Locator quality, explicit waits, uploads, downloads, dialogs, screenshots, and logs are key concerns.",
          "Long-running automation needs traceable logs, not just timeout errors.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是大量使用 `sleep`，不根据页面实际状态等待，这会让脚本又慢又不稳。",
          "误区二是定位过度依赖页面样式路径，一旦前端结构微调就全部失效。",
        ],
        bodyEn: [
          "Hard-coded sleeps are slow and fragile.",
          "Brittle locators tied to presentation details break easily.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先掌握元素定位、等待、异常处理，再上真实业务流程。",
          "如果自动化目标面向生产业务，建议同时准备账号隔离、重试、截图、日志和失败告警机制。",
        ],
        bodyEn: [
          "Master locating, waiting, and error handling before automating business flows.",
          "Production automation needs retries, screenshots, logs, and alerting.",
        ],
      },
    ],
  },
  {
    slug: "playwright",
    parentSlug: null,
    sortOrder: 160,
    titleZh: "学习 Playwright",
    titleEn: "Learn Playwright",
    summaryZh: "从现代浏览器自动化、端到端测试和页面抓取理解 Playwright，重点看它和 Selenium 的差异。",
    summaryEn: "Understand Playwright through modern browser automation, end-to-end testing, and extraction workflows.",
    sections: [
      {
        titleZh: "概述",
        titleEn: "Overview",
        bodyZh: [
          "Playwright 是现代浏览器自动化工具，强调稳定的等待机制、上下文隔离、多浏览器支持和更好的调试体验。",
          "它既适合做端到端测试，也适合做页面抓取、录制脚本和真实交互流程验证。",
        ],
        bodyEn: [
          "Playwright is a modern browser automation framework with strong waiting, isolation, and debugging support.",
          "It serves both end-to-end testing and interactive extraction workflows.",
        ],
      },
      {
        titleZh: "适合解决什么问题",
        titleEn: "Problems It Solves",
        bodyZh: [
          "适合现代前端页面测试、登录态隔离、多标签页流程、页面抓取、视觉回归和浏览器行为验证。",
          "如果项目大量使用动态加载和前端路由，Playwright 通常会比传统方案更省心。",
        ],
        bodyEn: [
          "It fits modern frontend apps, isolated sessions, multi-tab flows, scraping, and UI validation.",
          "Dynamic apps often benefit from Playwright's stronger synchronization model.",
        ],
      },
      {
        titleZh: "核心概念",
        titleEn: "Core Concepts",
        bodyZh: [
          "Browser、Context、Page 是最重要的三层。Context 可以理解为轻量级独立浏览器环境，便于做多账号隔离和并发测试。",
          "Locator、自动等待、Trace、截图和录制能力是 Playwright 的工程优势所在。",
        ],
        bodyEn: [
          "Browser, context, and page are the key structural concepts.",
          "Locators, auto-waiting, tracing, and recording are major practical strengths.",
        ],
      },
      {
        titleZh: "常见工作流",
        titleEn: "Typical Workflow",
        bodyZh: [
          "常见链路是：启动浏览器 -> 建立 Context -> 打开页面 -> 执行交互 -> 等待结果 -> 断言或抓取数据 -> 输出 trace 或截图。",
          "如果做批量抓取，通常会把任务拆到多个 context 或多个 page，但要注意频率控制。",
        ],
        bodyEn: [
          "A normal flow is launch, create context, open page, interact, wait, assert or extract, then emit traces or screenshots.",
          "Batch extraction often uses multiple contexts or pages with careful rate control.",
        ],
      },
      {
        titleZh: "常用能力 / 工具",
        titleEn: "Common Capabilities",
        bodyZh: [
          "常用能力包括网络拦截、请求模拟、文件上传下载、录屏、trace 回放和设备模拟。",
          "这些能力让它不仅能测页面，还能帮助你定位为什么某一步失败。",
        ],
        bodyEn: [
          "Network interception, mocking, uploads, downloads, tracing, and device emulation are common capabilities.",
          "These features make failure diagnosis much easier in real workflows.",
        ],
      },
      {
        titleZh: "常见误区",
        titleEn: "Common Pitfalls",
        bodyZh: [
          "误区一是并发开得太高，忽略目标站点承受能力和自己本机资源限制。",
          "误区二是把抓取逻辑、业务逻辑和测试断言混在一起，后期维护会很痛苦。",
        ],
        bodyEn: [
          "Over-aggressive concurrency can hurt both your machine and the target site.",
          "Mixing extraction, business rules, and assertions makes maintenance harder.",
        ],
      },
      {
        titleZh: "学习路径 / 实战建议",
        titleEn: "Learning Path",
        bodyZh: [
          "先学最基本的 page 交互、locator、等待和截图，再学 context、trace、网络拦截和批量执行。",
          "如果你的网站或桌面工具后面要做真实浏览器流程验证，Playwright 是很值得优先掌握的一套工具。",
        ],
        bodyEn: [
          "Start with basic page actions, locators, waits, and screenshots before moving into contexts and tracing.",
          "It is a strong first choice for real browser workflow verification.",
        ],
      },
    ],
  },
];
