import dayjs from "dayjs";

import {
  defaultDeveloperProfile,
  defaultDocItems,
  defaultDocsEditableContent,
  defaultHomeEditableContent,
  defaultResourceItems,
  defaultResourcesEditableContent,
} from "@/modules/site/content";
import { getManagedDownloadItems, localizeManagedDownloadItem } from "@/modules/site/download-items-store";
import { homeFeedSnapshotSchema } from "@/modules/site/schemas";
import {
  CURATED_HOME_FEED_SNAPSHOT,
  DEVELOPER_MANIFESTO_ZH,
  DEVELOPER_REPOSITORY_GROUPS,
  HOME_PAGE_COPY,
} from "@/modules/site/site-curated-data";
import { buildWorkosWindowsDownloadItem } from "@/modules/site/workos-desktop-release";
import type {
  DeveloperPageData,
  DocsPageData,
  DownloadsPageData,
  EditableDocItem,
  EditableResourceItem,
  HomeFeedItem,
  HomeFeedSection,
  HomeFeedSnapshot,
  HomePageData,
  LocalizedHomeFeedItem,
  LocalizedHomeFeedSection,
  SiteDocNode,
  SiteFooterData,
  SiteLanguage,
  SiteResourceItem,
  SiteStatRecord,
} from "@/types/site";

const ZERO_STATS: SiteStatRecord = {
  views: 0,
  likes: 0,
  downloads: 0,
};

type DocOverride = Pick<EditableDocItem, "summaryZh" | "summaryEn" | "sections">;

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolvePublicAppName(fallback: string) {
  return readOptionalEnv("NEXT_PUBLIC_APP_NAME") ?? fallback;
}

function resolvePublicBeian(fallback: string) {
  return {
    text: readOptionalEnv("NEXT_PUBLIC_ICP_BEIAN") ?? fallback,
    url: readOptionalEnv("NEXT_PUBLIC_ICP_BEIAN_URL") ?? "https://beian.miit.gov.cn/",
  };
}

function resolvePublicContactEmails() {
  return [
    { label: "QQ", value: "3431752914@qq.com", href: "mailto:3431752914@qq.com" },
    { label: "163", value: "15005828899@163.com", href: "mailto:15005828899@163.com" },
    { label: "Gmail", value: "qiushui1210@gmail.com", href: "mailto:qiushui1210@gmail.com" },
  ];
}

function localizeResource(item: EditableResourceItem, lang: SiteLanguage): SiteResourceItem {
  return {
    slug: item.slug,
    title: lang === "zh" ? item.titleZh : item.titleEn,
    summary: lang === "zh" ? item.summaryZh : item.summaryEn,
    format: lang === "zh" ? item.formatZh : item.formatEn,
    platform: lang === "zh" ? item.platformZh : item.platformEn,
    version: item.version,
    fileSize: item.fileSize,
    updatedAt: item.updatedAt,
    fileName: item.fileName,
    downloadPath: item.downloadPath,
    tutorialPdfName: item.tutorialPdfName,
    tutorialPdfPath: item.tutorialPdfPath,
    notes: lang === "zh" ? item.notesZh : item.notesEn,
    metrics: ZERO_STATS,
  };
}

function localizeDocNode(node: EditableDocItem, lang: SiteLanguage): SiteDocNode {
  return {
    slug: node.slug,
    title: lang === "zh" ? node.titleZh : node.titleEn,
    summary: lang === "zh" ? node.summaryZh : node.summaryEn,
    sections: node.sections.map((section) => ({
      title: lang === "zh" ? section.titleZh : section.titleEn,
      body: lang === "zh" ? section.bodyZh : section.bodyEn,
    })),
    children: [],
  };
}

function buildStructuredDocItems() {
  const categoryMap: Record<string, string> = {
    "ai-agent": "ai-foundations",
    "ai-basics": "ai-foundations",
    "machine-learning": "ai-foundations",
    nlp: "ai-foundations",
    "codex-tutorial": "ai-coding-tools",
    "claude-code": "ai-coding-tools",
    opencode: "ai-coding-tools",
    skills: "ai-coding-tools",
    langchain: "ai-coding-tools",
    ollama: "model-frameworks",
    tensorflow: "model-frameworks",
    pytorch: "model-frameworks",
    "scikit-learn": "model-frameworks",
    opencv: "automation-vision",
    selenium: "automation-vision",
    playwright: "automation-vision",
  };

  const categories: EditableDocItem[] = [
    {
      slug: "ai-foundations",
      parentSlug: null,
      sortOrder: 10,
      titleZh: "AI 基础认知",
      titleEn: "AI Foundations",
      summaryZh: "先建立 AI、智能体、机器学习和 NLP 的基础框架，再决定后续深入方向。",
      summaryEn: "Build a practical foundation in AI, agents, machine learning, and NLP before going deeper.",
      sections: [
        {
          titleZh: "这一组看什么",
          titleEn: "What This Track Covers",
          bodyZh: [
            "这一组适合先搭整体认知框架，重点不是背定义，而是理解每个概念在实际项目里分别解决什么问题。",
            "如果你后面还要继续看 AI 编程工具、模型框架和自动化内容，先把这一层看顺，后面的选择会更稳。",
          ],
          bodyEn: [
            "This track builds a practical mental model for AI concepts before you dive into tooling or frameworks.",
            "The goal is to understand what each concept solves inside real projects, not just memorize terms.",
          ],
        },
      ],
    },
    {
      slug: "ai-coding-tools",
      parentSlug: null,
      sortOrder: 20,
      titleZh: "AI 编程工具",
      titleEn: "AI Coding Tools",
      summaryZh: "围绕终端代理、技能单元、上下文工程和工作流编排，理解工具如何进入开发流程。",
      summaryEn: "Understand how terminal agents, skills, context engineering, and workflow orchestration fit into delivery.",
      sections: [
        {
          titleZh: "这一组看什么",
          titleEn: "What This Track Covers",
          bodyZh: [
            "这一组重点不是模型原理，而是开发协作。要解决的是工具怎么选、怎么接入、怎么降低误操作和返工。",
            "如果你的目标是让 AI 真的参与代码、文档、调试和交付，这一组比纯理论更直接。",
          ],
          bodyEn: [
            "This track focuses on engineering collaboration rather than model theory.",
            "It helps you place AI tools inside coding, review, debugging, and delivery workflows.",
          ],
        },
      ],
    },
    {
      slug: "model-frameworks",
      parentSlug: null,
      sortOrder: 30,
      titleZh: "模型与框架",
      titleEn: "Models and Frameworks",
      summaryZh: "本地运行、训练框架和传统机器学习工具都放在这一组，方便按工程层面理解。",
      summaryEn: "This track groups local runtimes, training frameworks, and classic machine-learning tools.",
      sections: [
        {
          titleZh: "这一组看什么",
          titleEn: "What This Track Covers",
          bodyZh: [
            "如果你的关注点更偏模型部署、训练栈和数据实验，这一组最相关。",
            "这里不只看 API 调用，而是看模型如何被运行、训练、评估和接入现有系统。",
          ],
          bodyEn: [
            "This track is for model runtime, training stack, and experiment-heavy work.",
            "It focuses on how models are run, trained, evaluated, and integrated into real systems.",
          ],
        },
      ],
    },
    {
      slug: "automation-vision",
      parentSlug: null,
      sortOrder: 40,
      titleZh: "自动化与视觉",
      titleEn: "Automation and Vision",
      summaryZh: "浏览器自动化、界面验收和图像处理放在一起，方便串起脚本执行与页面验证场景。",
      summaryEn: "Browser automation, UI verification, and image processing are grouped into one execution-oriented track.",
      sections: [
        {
          titleZh: "这一组看什么",
          titleEn: "What This Track Covers",
          bodyZh: [
            "这一组更偏执行层，适合做脚本、测试、抓取、截图验收和基础视觉处理。",
            "如果你要把 AI、网页流程和自动化串在一起，这一组能提供更直接的落地方式。",
          ],
          bodyEn: [
            "This track is execution-heavy and useful for scripting, testing, scraping, and visual verification.",
            "It becomes especially practical when AI needs to interact with real pages and automation flows.",
          ],
        },
      ],
    },
  ];

  const overrides: Record<string, DocOverride> = {
    "ai-agent": {
      summaryZh:
        "把 AI Agent 理解成可执行的任务系统，而不是聊天壳子。重点看目标、上下文、工具、验证、回滚和人工接管点。",
      summaryEn:
        "Treat an AI agent as an executable task system rather than a chatbot wrapper, with focus on goals, context, tools, validation, recovery, and human handoff.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "AI Agent 的价值不在于它能不能像人聊天，而在于它能不能围绕一个目标持续推进动作。它接收任务、组织上下文、拆步骤、调用工具、读取结果，再决定下一步。",
            "所以智能体和普通问答模型的核心差别，不是模型名字，而是有没有完整执行环路。没有执行环路，就只是一次性的回答接口。",
          ],
          bodyEn: [
            "The value of an AI agent comes from sustained execution toward a goal rather than conversational style.",
            "What separates an agent from plain chat is the presence of a full execution loop.",
          ],
        },
        {
          titleZh: "适合什么任务",
          titleEn: "Best-Fit Tasks",
          bodyZh: [
            "最适合的是多步骤、可验证、需要外部工具或状态记忆的任务，例如巡检、资料汇总、代码协作、批量处理和跨系统流程。",
            "如果问题一轮回答就能结束，或者根本不需要工具和状态，强行上 Agent 只会增加成本和调试复杂度。",
          ],
          bodyEn: [
            "Agents fit multi-step tasks that need validation, tools, and memory.",
            "For one-shot questions, agent overhead often adds complexity without enough benefit.",
          ],
        },
        {
          titleZh: "核心组成",
          titleEn: "Core Building Blocks",
          bodyZh: [
            "一个能稳定运行的智能体，至少要有目标输入、上下文装配、计划机制、工具执行、结果验证五层。很多演示只做到了前三层，所以看起来聪明，但一落地就容易失控。",
            "再往上走，还要补日志、权限、失败重试、成本控制和人工接管点。这些不是附属功能，而是生产可用性的底线。",
          ],
          bodyEn: [
            "A stable agent needs goal intake, context assembly, planning, tool execution, and result validation.",
            "Production systems also need logs, permissions, retries, cost limits, and human handoff points.",
          ],
        },
        {
          titleZh: "工作流模板",
          titleEn: "Workflow Template",
          bodyZh: [
            "常见链路是：接收任务 -> 补齐上下文 -> 判断是否拆步 -> 生成计划 -> 选择工具 -> 执行动作 -> 校验结果 -> 决定继续或结束。",
            "真正成熟的地方不在于流程图画得漂亮，而在于每一步都能被观察、复现和修正。只要某一步失败后无法定位，这个工作流就还不够成熟。",
          ],
          bodyEn: [
            "A common flow is task intake, context loading, planning, tool choice, execution, validation, and finish-or-continue control.",
            "A mature workflow is one where every step is observable, reproducible, and recoverable.",
          ],
        },
        {
          titleZh: "高价值场景",
          titleEn: "High-Value Scenarios",
          bodyZh: [
            "高价值场景通常出现在“重复 + 判断 + 外部动作”三者同时存在的时候，例如日报汇总、线上巡检、仓库检查、网页批处理和知识库整理。",
            "这些工作人工做不算难，但耗时且容易漏。Agent 的价值就在于把稳定动作自动化，把人保留在关键判断点上。",
          ],
          bodyEn: [
            "Agents create the most value where repetition, judgment, and external actions all appear together.",
            "They automate stable execution while keeping humans on the highest-value decisions.",
          ],
        },
        {
          titleZh: "实操建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "刚开始不要做全能智能体，先选一个短链路目标，例如“收集资料并输出结构化摘要”或“读取仓库并列出风险点”。",
            "流程越短，越容易验证每一层是否真的在起作用。先做单任务闭环，再谈多工具、多角色和长时运行。",
          ],
          bodyEn: [
            "Do not start with an all-purpose agent. Begin with a short measurable loop.",
            "A smaller loop makes it easier to verify every layer before adding more tools or roles.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "误区一是把 Agent 当万能外包，什么都想交给它。误区二是只堆工具不做验证，导致动作越来越多，结果越来越不可信。",
            "误区三是上来就做多智能体。单智能体链路都没跑稳时，多角色协作通常只会把问题藏得更深。",
          ],
          bodyEn: [
            "Typical pitfalls include treating agents as universal outsourcing, piling on tools without validation, and jumping into multi-agent setups too early.",
            "Multi-agent systems usually amplify hidden instability if the single-agent path is not already solid.",
          ],
        },
      ],
    },
    "ai-basics": {
      summaryZh: "从模型、数据、训练、推理和系统边界建立 AI 基础框架，避免只会调接口却不理解约束条件。",
      summaryEn:
        "Build an AI foundation through models, data, training, inference, and system boundaries so API use is grounded in real understanding.",
      sections: [
        {
          titleZh: "先建立什么认知",
          titleEn: "What to Understand First",
          bodyZh: [
            "AI 基础不是记术语，而是先分清模型、数据、训练、推理各自扮演什么角色。模型负责模式表达，数据决定学习素材，训练改变参数，推理负责实际使用。",
            "只要这四层没有分开，后面讨论成本、效果、时延和部署时就容易全部混在一起。",
          ],
          bodyEn: [
            "Separate model, data, training, and inference first.",
            "Without that separation, later discussion about cost, quality, latency, and deployment becomes confused.",
          ],
        },
        {
          titleZh: "AI 系统不等于模型",
          titleEn: "An AI System Is Not Just the Model",
          bodyZh: [
            "真实项目里的 AI 系统，除了模型本身，还包括输入处理、上下文装配、权限控制、缓存、日志、兜底策略和人工回退。",
            "很多人只盯着模型效果，忽略系统工程，最后结果是 Demo 好看，线上体验却不稳定。",
          ],
          bodyEn: [
            "A real AI system includes input handling, context assembly, logging, fallback, and control layers in addition to the model.",
            "Ignoring system engineering often leads to strong demos but unstable production behavior.",
          ],
        },
        {
          titleZh: "评估到底看什么",
          titleEn: "What Evaluation Should Measure",
          bodyZh: [
            "评估不只看“像不像”，还要看稳定性、可重复性、时延、成本和出错后的影响范围。不同业务里，这几个指标的重要性顺序并不一样。",
            "所以做 AI 评估时，最好先明确目标，不要只看单次样例表现。",
          ],
          bodyEn: [
            "Evaluation should consider stability, repeatability, latency, cost, and failure impact rather than only output quality.",
            "One impressive sample is not enough to judge real-world usefulness.",
          ],
        },
        {
          titleZh: "怎么开始做第一个系统",
          titleEn: "How to Build the First System",
          bodyZh: [
            "对开发者来说，最高效的入门方式通常不是先看一堆大教程，而是边学边做一个小系统，例如问答、分类、摘要或简单自动化助手。",
            "只要能把输入、处理、输出和验证链路跑通，你对 AI 的理解就会比只会调用接口深很多。",
          ],
          bodyEn: [
            "For developers, the fastest way to learn is to build a small system while studying.",
            "Connecting input, processing, output, and validation teaches more than isolated API calls.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题包括只记模型名，不理解使用边界；只看生成效果，不看系统稳定性；只会调接口，不会设计验证方法。",
            "这些问题会让项目在概念上看似先进，但在工程上很难真正落地。",
          ],
          bodyEn: [
            "Common pitfalls include memorizing model names without understanding boundaries, chasing output quality without system stability, and skipping validation design.",
            "These mistakes make projects look advanced conceptually while staying weak operationally.",
          ],
        },
      ],
    },
    "machine-learning": {
      summaryZh: "从数据、特征、目标函数、评估方式和泛化能力理解机器学习，不把它简化成“丢数据进去等结果”。",
      summaryEn:
        "Understand machine learning through data, features, objectives, evaluation, and generalization rather than as a black box.",
      sections: [
        {
          titleZh: "机器学习在做什么",
          titleEn: "What Machine Learning Does",
          bodyZh: [
            "机器学习本质上是在给定数据和目标的前提下，学习一个可以泛化到新样本的函数。关键点不只是拟合，而是能不能在未见数据上保持效果。",
            "所以训练得好看不等于能上线，泛化能力才是价值核心。",
          ],
          bodyEn: [
            "Machine learning learns a function from data and an objective, but the real value comes from generalizing to unseen samples.",
            "A good training result alone does not prove production usefulness.",
          ],
        },
        {
          titleZh: "数据往往先决定上限",
          titleEn: "Data Often Sets the Ceiling",
          bodyZh: [
            "很多项目不是败在模型选错，而是败在数据采样、标注质量、分布偏差和特征设计上。",
            "当数据本身不稳定时，换再复杂的模型也只是放大噪声。",
          ],
          bodyEn: [
            "Many ML failures come from sampling, labeling, distribution shift, or feature issues rather than model choice.",
            "Complex models cannot rescue unstable data foundations.",
          ],
        },
        {
          titleZh: "实验阶段怎么做",
          titleEn: "How to Work in the Experiment Phase",
          bodyZh: [
            "实验阶段主要目标是形成可靠比较，而不是盲目刷高一个数字。你需要固定数据切分、统一指标和可复现的实验记录。",
            "没有实验纪律时，模型迭代会变成凭感觉试错，最后很难知道到底是哪一步带来了提升。",
          ],
          bodyEn: [
            "The experiment phase should focus on reliable comparison rather than chasing a single metric blindly.",
            "Without discipline in splits, metrics, and logs, iteration becomes guesswork.",
          ],
        },
        {
          titleZh: "从实验到上线",
          titleEn: "From Experiment to Production",
          bodyZh: [
            "上线阶段除了模型效果，还要处理特征一致性、监控、漂移检测、重训策略和版本管理。",
            "一套只能在 notebook 里跑的模型，不算真正完成工程化。",
          ],
          bodyEn: [
            "Production adds feature consistency, monitoring, drift detection, retraining strategy, and version management.",
            "A notebook-only model is not a finished engineering result.",
          ],
        },
        {
          titleZh: "实操建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "先建立一个简单基线，再逐步增加特征、调参和更复杂模型，而不是一开始就追求最高复杂度方案。",
            "只要基线明确，后面的优化、对比和是否继续投入，都会更有依据。",
          ],
          bodyEn: [
            "Build a simple baseline first and add complexity gradually.",
            "A clear baseline makes later optimization and investment decisions much more rational.",
          ],
        },
      ],
    },
    nlp: {
      summaryZh: "从文本表示、任务类型、输出标准和应用边界理解 NLP，知道什么时候该用规则、什么时候该用模型。",
      summaryEn:
        "Understand NLP through text representation, task types, output standards, and application boundaries so you can choose between rules and models pragmatically.",
      sections: [
        {
          titleZh: "NLP 关注什么",
          titleEn: "What NLP Focuses On",
          bodyZh: [
            "NLP 处理的是文本、语义和语言结构，常见任务包括分类、抽取、检索、生成、问答和对话。",
            "不同任务需要的能力差异很大，不能把“会生成文字”和“能稳定完成业务任务”混为一谈。",
          ],
          bodyEn: [
            "NLP covers text, semantics, and language structure across tasks like classification, extraction, retrieval, generation, QA, and dialogue.",
            "Text generation ability is not the same as stable business-task completion.",
          ],
        },
        {
          titleZh: "规则和模型怎么选",
          titleEn: "Choosing Rules or Models",
          bodyZh: [
            "高稳定、边界清晰的小任务，规则通常更便宜也更可控；语义复杂、表达变化大的任务，模型更有优势。",
            "成熟系统里经常是二者混用，而不是非黑即白。",
          ],
          bodyEn: [
            "Small stable tasks with clear boundaries often suit rules better, while semantic variation favors models.",
            "Mature systems often combine both approaches instead of choosing only one.",
          ],
        },
        {
          titleZh: "先定义输出标准",
          titleEn: "Define the Output Standard First",
          bodyZh: [
            "做 NLP 项目时，先定义任务输出标准，再决定是做抽取、分类还是生成。不要先选模型，再回头找问题。",
            "一旦输出标准明确，数据准备、评估方式和上线策略都会清晰很多。",
          ],
          bodyEn: [
            "Define the output standard before deciding whether the task is extraction, classification, or generation.",
            "Once the target output is clear, data prep, evaluation, and deployment strategy become much easier.",
          ],
        },
        {
          titleZh: "常见实战场景",
          titleEn: "Common Practical Scenarios",
          bodyZh: [
            "常见场景包括客服意图识别、知识问答、文档摘要、关键词抽取、内容审核和结构化信息提取。",
            "这些任务虽然都处理文字，但工程重点并不一样，所以一开始就要明确业务目标，而不是只看技术名词。",
          ],
          bodyEn: [
            "Common scenarios include intent detection, knowledge QA, summarization, keyword extraction, moderation, and structured information extraction.",
            "They all use text, but the engineering focus differs, so business goals should be made explicit early.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题包括任务定义模糊、评估标准不一致，以及把生成能力误当成业务完成能力。",
            "如果没有清晰的输出约束，NLP 系统会看起来很聪明，但很难稳定服务真实场景。",
          ],
          bodyEn: [
            "Common pitfalls include vague task definitions, inconsistent evaluation, and confusing generation ability with business-task reliability.",
            "Without output constraints, NLP systems often look impressive but fail to serve real workflows consistently.",
          ],
        },
      ],
    },
    "codex-tutorial": {
      summaryZh:
        "把 Codex 当成终端里的工程代理来用。它擅长读仓库、拆任务、改代码、跑验证，更适合真正落地，而不是空谈方案。",
      summaryEn:
        "Use Codex as a terminal-native engineering agent that reads repos, slices tasks, edits code, and validates results.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Codex 的优势不是单轮灵感回答，而是在真实仓库里持续工作。它会先读代码和环境，再决定改哪里、怎么验证，适合拿来做实事。",
            "因此，使用 Codex 时最重要的不是把提示词写得花哨，而是把任务目标、目录范围和验证标准说清楚。",
          ],
          bodyEn: [
            "Codex shines when it can work inside a real repository rather than produce one-off answers.",
            "Clear goals, scope, and verification criteria matter more than fancy prompting.",
          ],
        },
        {
          titleZh: "适合什么任务",
          titleEn: "Best-Fit Tasks",
          bodyZh: [
            "它很适合修复 bug、补页面逻辑、改接口、整理部署脚本、做代码审查和补测试，因为这些任务都依赖本地上下文和可执行验证。",
            "如果只是泛泛聊产品方向，或者没有仓库和文件可看，它的优势就发挥不出来。",
          ],
          bodyEn: [
            "It fits bug fixing, feature work, interface updates, deployment tasks, code review, and test additions.",
            "Without repository context or executable artifacts, its advantage weakens significantly.",
          ],
        },
        {
          titleZh: "工作循环怎么用",
          titleEn: "How to Use the Work Loop",
          bodyZh: [
            "比较稳的方式是四步循环：先检查上下文，再切成小任务，然后改动并验证，最后给出结果说明。这和成熟工程师处理任务的节奏是一致的。",
            "你越让它在可验证的小闭环里工作，输出就越稳定；一次塞太多要求，反而更容易偏题。",
          ],
          bodyEn: [
            "A reliable loop is inspect context, slice the task, edit carefully, and verify before reporting.",
            "Small verifiable loops produce stronger results than huge open-ended requests.",
          ],
        },
        {
          titleZh: "和自动补全的区别",
          titleEn: "How It Differs from Autocomplete",
          bodyZh: [
            "自动补全解决的是“下一行怎么写”，Codex 更接近“这整件事怎么落地”。它会跨文件分析依赖关系，也会考虑构建、测试和运行结果。",
            "所以它不是更大的补全，而是更偏执行型的协作代理。",
          ],
          bodyEn: [
            "Autocomplete suggests the next line; Codex reasons about the whole task across files, tests, and runtime behavior.",
            "It is an execution-oriented collaborator rather than simply a larger completion engine.",
          ],
        },
        {
          titleZh: "高价值用法",
          titleEn: "High-Value Usage Patterns",
          bodyZh: [
            "高价值用法包括：先让它定位根因，再做最小修复；先让它读现有实现，再补页面或接口；先让它列影响面，再动部署和配置。",
            "本质上都是先让它做上下文压缩，再做执行，这比一上来就要求“全部做好”更稳。",
          ],
          bodyEn: [
            "High-value use starts with diagnosis and scope compression before execution.",
            "Root-cause analysis, impact review, and minimal verified changes are especially strong patterns.",
          ],
        },
        {
          titleZh: "任务应该怎么下",
          titleEn: "How to Frame Tasks",
          bodyZh: [
            "比较好的下达方式通常包含四件事：目标、工作目录、不要碰的范围、完成后怎么验收。",
            "如果任务较大，就按增量切片推进，每一段都过 `lint`、`build` 或最小手工验收，再做下一段。",
          ],
          bodyEn: [
            "A strong task frame usually includes the goal, working directory, out-of-scope areas, and acceptance criteria.",
            "Large work should be sliced incrementally with lint, build, or manual verification after each segment.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见误区是不提供上下文、一次塞太大范围、改完不验证，只看它说“已完成”。",
            "这些问题本质上通常不是模型能力不足，而是任务边界和验证纪律不足。",
          ],
          bodyEn: [
            "Typical mistakes are missing context, oversized scope, and trusting completion claims without verification.",
            "These are usually process failures rather than pure model failures.",
          ],
        },
      ],
    },
    "claude-code": {
      summaryZh:
        "Claude Code 更适合长上下文理解、重构分析、迁移说明和文档组织。它在“讲清楚”这件事上通常比“直接落地执行”更突出。",
      summaryEn:
        "Claude Code is strong at long-context understanding, migration analysis, and structured explanation, often outperforming on synthesis over direct execution.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Claude Code 的优势通常在于长上下文阅读和解释能力。面对大仓库、复杂模块关系或历史设计决策时，它更擅长先把全貌讲清楚。",
            "如果你经常需要读旧系统、准备迁移方案、整理 PR 说明或写技术文档，它会很顺手。",
          ],
          bodyEn: [
            "Claude Code often stands out in long-context reading and synthesis across large codebases.",
            "It is especially useful when the first job is to understand and explain the system clearly.",
          ],
        },
        {
          titleZh: "适合什么任务",
          titleEn: "Best-Fit Tasks",
          bodyZh: [
            "它比较适合代码库讲解、模块关系梳理、历史兼容点分析、重构建议、迁移风险盘点和文档生成。",
            "这类任务的共同点是需要先形成一致认知，再决定如何动手。",
          ],
          bodyEn: [
            "It fits repository explanation, dependency mapping, compatibility review, refactor planning, migration risk review, and documentation generation.",
            "These tasks benefit from coherent synthesis before execution begins.",
          ],
        },
        {
          titleZh: "工作方式的特点",
          titleEn: "What Its Working Style Looks Like",
          bodyZh: [
            "它通常先吃进较多上下文，再输出结构化说明，例如模块职责、数据流、风险点和建议路径。",
            "这种模式在“先理解后执行”的场景里很有价值，但如果你只想快速修一个已知的小问题，就未必是最快路线。",
          ],
          bodyEn: [
            "Its common mode is to ingest broad context and return a structured synthesis of modules, flows, risks, and options.",
            "That is excellent for understanding-first work, but not always the fastest route for tiny known fixes.",
          ],
        },
        {
          titleZh: "和执行型代理怎么配合",
          titleEn: "How It Pairs with Execution-First Agents",
          bodyZh: [
            "执行型代理更强调直接读文件、改代码、跑验证；Claude Code 更像一个长上下文架构搭子，擅长把复杂局面讲清楚。",
            "很多团队会先用它做理解和规划，再交给执行型代理推进落地，两者不是替代关系。",
          ],
          bodyEn: [
            "Execution-first agents focus on editing and verification, while Claude Code behaves more like a long-context reasoning partner.",
            "Teams often use both: one for understanding and planning, one for shipping the change.",
          ],
        },
        {
          titleZh: "高价值用法",
          titleEn: "High-Value Usage Patterns",
          bodyZh: [
            "高价值用法包括：让它先解释老项目结构、列迁移步骤、整理接口契约和边界，再进入编码阶段。",
            "这能明显减少“边做边猜”的返工，尤其是在老代码或多人协作环境里。",
          ],
          bodyEn: [
            "High-value uses include architecture explanation, migration step drafting, and interface-boundary clarification before coding.",
            "This reduces rework in older or highly collaborative codebases.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "误区一是把分析结果当事实，不再验证代码。误区二是规划做得很细，却没有后续执行闭环。",
            "说得清楚不代表一定落得下来，最后还是要靠代码和验证收口。",
          ],
          bodyEn: [
            "A clear analysis still needs code-level verification.",
            "Detailed plans only create value when followed by an execution loop.",
          ],
        },
      ],
    },
    opencode: {
      summaryZh:
        "OpenCode 更强调开放和可定制，适合需要自定义模型来源、权限策略和终端工作流的团队，但前提是你能控制住复杂度。",
      summaryEn:
        "OpenCode emphasizes openness and customization for teams that need flexible providers, permission models, and terminal workflows.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "OpenCode 的核心吸引力在于开放性。你可以更自由地组合模型来源、命令执行方式、集成脚本和内部流程，而不必完全依赖单一厂商体验。",
            "这类工具通常更适合有工程基础、想把 AI 协作纳入私有流程的团队。",
          ],
          bodyEn: [
            "OpenCode is attractive because it offers more freedom over models, command execution, and internal workflow integration.",
            "It is a strong fit for teams that want AI collaboration inside private engineering processes.",
          ],
        },
        {
          titleZh: "适合什么任务",
          titleEn: "Best-Fit Tasks",
          bodyZh: [
            "当你需要多模型切换、私有工具接入、内部规范落地、权限受控执行或与现有脚本体系融合时，它会更有优势。",
            "如果你只想开箱即用、少配置、立刻开始，完全开放的工具不一定是最省事的选择。",
          ],
          bodyEn: [
            "It fits multi-provider access, internal tooling, controlled execution, and deep workflow integration.",
            "If you want instant simplicity, a highly open tool may not be the fastest path.",
          ],
        },
        {
          titleZh: "核心价值在哪里",
          titleEn: "Where the Core Value Comes From",
          bodyZh: [
            "核心价值不在“功能更多”，而在“能按你的工作流组织功能”。这意味着它更像一个可组装平台，而不是只提供固定交互入口的产品。",
            "对于规范成熟的团队，这种可组装性很有价值；对于流程还不清晰的团队，反而可能变成额外负担。",
          ],
          bodyEn: [
            "Its value comes from shaping features around your workflow rather than forcing a fixed interface.",
            "That flexibility helps mature teams more than teams without stable operating habits.",
          ],
        },
        {
          titleZh: "实操接入建议",
          titleEn: "Practical Integration Advice",
          bodyZh: [
            "正确做法通常是先只接一两个高价值能力，例如代码读取和固定命令执行，再逐步补模型切换、内部接口和团队规范。",
            "先跑通最小链路，再扩可配置面，才不会把开放性变成维护负担。",
          ],
          bodyEn: [
            "Start with one or two high-value capabilities and expand only after the smallest workflow is stable.",
            "Prove the minimum path first, then widen the configuration surface carefully.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "最大的误区是过度定制。配置项越多，不代表产出越好；没有日志、权限、失败处理和审计时，灵活性只会放大风险。",
            "另一类问题是把工具能力和团队能力混淆，认为只要工具够开放，流程问题就会自动消失。",
          ],
          bodyEn: [
            "The biggest pitfall is over-customization without control layers like logs, permissions, and auditing.",
            "Tool flexibility does not automatically solve weak team process.",
          ],
        },
      ],
    },
    skills: {
      summaryZh:
        "Skills 适合把重复性协作方式沉淀成可复用能力单元，让代理在固定触发条件下按既定流程做事，而不是每次都从零提示。",
      summaryEn:
        "Skills turn repeated collaboration patterns into reusable capability units so agents can act on stable triggers instead of fresh prompting every time.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Skill 可以理解为“可复用的任务说明书 + 边界约束 + 参考材料入口”。它不是单纯的一段提示词，而是让某类任务有固定做法。",
            "当同一种事情会被反复做，例如修 CI、做代码审查、写 ADR、上线检查，Skill 的价值就会非常明显。",
          ],
          bodyEn: [
            "A skill is a reusable task playbook with scope, guardrails, and reference entry points.",
            "It becomes most valuable when the same type of work happens repeatedly.",
          ],
        },
        {
          titleZh: "和普通提示词的区别",
          titleEn: "How It Differs from Plain Prompts",
          bodyZh: [
            "普通提示词偏一次性，Skill 偏制度化。前者解决当前对话，后者解决某类任务长期怎么做。",
            "所以 Skill 更强调触发规则、执行顺序、参考文件和失败时的降级策略。",
          ],
          bodyEn: [
            "Prompts are often one-off while skills are operationalized for repeated use.",
            "Skills define triggers, execution order, references, and fallback behavior.",
          ],
        },
        {
          titleZh: "一个好 Skill 要写清什么",
          titleEn: "What a Good Skill Must Define",
          bodyZh: [
            "一个好 Skill 至少要写清楚四件事：什么时候用、先做什么、要读哪些材料、什么情况下不要继续。",
            "如果只有原则没有动作，或者只有动作没有边界，这个 Skill 都很难稳定复用。",
          ],
          bodyEn: [
            "A good skill explains when to use it, what to do first, what references to read, and when to stop or switch approach.",
            "Without both actionability and boundaries, reuse becomes unreliable.",
          ],
        },
        {
          titleZh: "什么任务值得抽成 Skill",
          titleEn: "What Work Should Become a Skill",
          bodyZh: [
            "适合沉淀成 Skill 的通常是高频、可拆步骤、验收方式明确的任务，例如提测前检查、PR 回评审、构建失败定位和发布清单。",
            "低频且高度依赖临场判断的任务，不一定值得抽成 Skill。",
          ],
          bodyEn: [
            "Tasks that are frequent, stepwise, and easy to validate are ideal skill candidates.",
            "Rare tasks that depend heavily on situational judgment are usually weaker candidates.",
          ],
        },
        {
          titleZh: "实操建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "先从一个高频痛点开始做 Skill，例如“多文件功能实现要先切片再验证”。当它在几个真实任务里都有效，再继续抽更多能力。",
            "Skill 的成熟不是看写了多少，而是看它能否连续在真实任务里减少返工。",
          ],
          bodyEn: [
            "Start from one high-frequency pain point and prove the skill across several real tasks.",
            "Skill maturity is measured by repeated reduction of rework, not by volume alone.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "误区一是切得太碎，导致调用成本高于收益。误区二是写得太宽泛，变成任何事都能套但任何事都做不精。",
            "误区三是只写理念，不写命令、检查项和输出要求，这种 Skill 基本无法稳定执行。",
          ],
          bodyEn: [
            "A skill can fail by being too granular, too broad, or too abstract to execute consistently.",
            "Concrete commands, checks, and output expectations are often what make it useful.",
          ],
        },
      ],
    },
    langchain: {
      summaryZh:
        "LangChain 更适合组织检索、工具调用和链路编排。它不是魔法代理框架，而是一套帮你把复杂流程工程化的组件体系。",
      summaryEn:
        "LangChain is best used to organize retrieval, tool use, and workflow orchestration rather than as a magic agent box.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "LangChain 的定位更接近“编排层”。它帮助你把模型调用、提示模板、检索、工具、输出解析和状态流转串起来。",
            "如果你的系统已经不再是简单的一次性问答，而是开始出现多阶段处理，它就会变得有用。",
          ],
          bodyEn: [
            "LangChain acts like an orchestration layer for model calls, prompts, retrieval, tools, output parsing, and state flow.",
            "It becomes useful once your app moves beyond single-turn interactions.",
          ],
        },
        {
          titleZh: "适合什么任务",
          titleEn: "Best-Fit Tasks",
          bodyZh: [
            "典型适用场景包括 RAG、工具调用、多步问答、结构化输出和上下文链路组织。它特别适合把多个能力串起来的系统。",
            "如果任务非常固定、流程极短，直接写原生代码可能更简单。",
          ],
          bodyEn: [
            "It fits RAG, tool use, multi-step QA, structured output, and context-heavy workflows.",
            "For short fixed flows, plain application code may still be simpler.",
          ],
        },
        {
          titleZh: "和 LangGraph 的关系",
          titleEn: "How It Relates to LangGraph",
          bodyZh: [
            "LangChain 更偏组件和链路拼装，LangGraph 更偏状态图和复杂控制流。前者适合先把能力连起来，后者适合需要明确节点和分支的大流程。",
            "很多时候不是二选一，而是先用 LangChain 组织能力，再在复杂场景下引入更强的图式控制。",
          ],
          bodyEn: [
            "LangChain focuses on components and chains, while LangGraph emphasizes state graphs and explicit control flow.",
            "They are often complementary rather than mutually exclusive.",
          ],
        },
        {
          titleZh: "核心模块怎么看",
          titleEn: "How to View the Core Modules",
          bodyZh: [
            "可以把它拆成几类：模型接入、提示模板、检索层、工具层、输出解析和链路编排。每一层都在帮你降低重复接线成本。",
            "真正重要的是别把框架概念当业务目标。框架只是为了让流程更清晰，不是为了堆更多抽象层。",
          ],
          bodyEn: [
            "Think of it as model integration, prompt templates, retrieval, tools, output parsing, and orchestration.",
            "The framework serves workflow clarity rather than existing as a goal by itself.",
          ],
        },
        {
          titleZh: "实操建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "实战里建议先做最小链路，例如“检索 + 生成”或“工具调用 + 结构化输出”，跑稳后再扩展记忆、多步控制和复杂分支。",
            "不要一开始就想做全能代理，先把一个小链路做可靠，比同时搭十个模块更有价值。",
          ],
          bodyEn: [
            "Start with a minimum path like retrieval plus generation or tool use plus structured output.",
            "A reliable small chain creates more value than an ambitious unstable all-in-one agent.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "误区一是为了用框架而用框架，导致原本简单流程被过度抽象。误区二是把所有问题都交给 Agent，而不是先识别哪些流程其实是确定性的。",
            "误区三是对检索层过度乐观，默认召回上来就一定可用，结果忽略了分块、排序和上下文压缩的难点。",
          ],
          bodyEn: [
            "Common mistakes include over-abstraction, using agents where deterministic flows suffice, and being naive about retrieval quality.",
            "Retrieval usually needs careful chunking, ranking, and context compression.",
          ],
        },
      ],
    },
    ollama: {
      summaryZh: "Ollama 适合本地运行模型，重点是部署便利、隐私控制、离线实验和与现有服务的轻量接入。",
      summaryEn:
        "Ollama is useful for local model runtime, especially when privacy, offline work, and lightweight service integration matter.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Ollama 最适合拿来快速搭一个本地模型运行环境。它不是训练框架，而是偏运行时和调用层，让你不用先折腾完整推理栈，就能把模型拉起来。",
            "如果你的目标是先验证某个本地问答、摘要、分类或辅助脚本思路，Ollama 通常比从零配模型环境更省时间。",
          ],
          bodyEn: [
            "Ollama is primarily a runtime layer for getting local models up quickly rather than a training framework.",
            "It is a practical starting point for validating local assistants, summarization, or lightweight automation ideas.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "它适合本地测试、内网环境、隐私敏感数据、离线演示和不希望强依赖外部 API 的项目。",
            "如果项目强调数据不出机、原型验证快、部署依赖少，本地模型运行通常是值得先试的路线。",
          ],
          bodyEn: [
            "It fits local testing, internal networks, privacy-sensitive data, offline demos, and reduced reliance on outside APIs.",
            "It is a strong option when speed of prototyping and data locality both matter.",
          ],
        },
        {
          titleZh: "配置时看什么",
          titleEn: "What to Watch During Setup",
          bodyZh: [
            "配置时主要看三件事：模型体量、机器资源、调用方式。模型越大，对内存和推理速度的要求越高；接口接入方式则决定后面系统怎么集成。",
            "同样是能跑起来，不同量化版本的体验差异可能非常明显，所以不要只看启动是否成功。",
          ],
          bodyEn: [
            "During setup, focus on model size, hardware capacity, and interface integration.",
            "A model that starts successfully may still be too slow or too constrained for real use, especially across quantization variants.",
          ],
        },
        {
          titleZh: "实战接入建议",
          titleEn: "Practical Integration Advice",
          bodyZh: [
            "实战里建议先用它做一个单一能力服务，例如本地问答、文本改写或简单分类，再通过 HTTP 或脚本接进现有项目。",
            "先验证延迟、稳定性和资源占用，再决定是否扩大到多模型或长上下文场景，比一开始就做大系统更稳。",
          ],
          bodyEn: [
            "A practical first step is exposing one narrow capability such as local QA, rewriting, or classification through a simple interface.",
            "Validate latency, stability, and resource cost before scaling to larger or multi-model workflows.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "最常见的坑是高估本地机器能力，导致模型虽然能跑，但响应过慢，实际不可用。另一个坑是忽略上下文窗口和并发能力，结果一接业务就卡住。",
            "还有人把本地运行误以为等于零成本，实际上机器资源、维护时间和模型更新也都是成本。",
          ],
          bodyEn: [
            "A common pitfall is overestimating local hardware and ending up with unusable latency.",
            "Another is assuming local runtime means zero cost while ignoring maintenance, resource usage, and update overhead.",
          ],
        },
      ],
    },
    tensorflow: {
      summaryZh: "TensorFlow 更适合偏训练、部署和生态整合的场景，适合长期维护、规范化较强的模型工程体系。",
      summaryEn: "TensorFlow is strong for training, deployment, and ecosystem-heavy production environments.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "TensorFlow 不只是一个训练库，它更像是一整套模型工程生态。从训练到服务化，再到移动端与推理部署，它都有较完整的配套。",
            "如果你做的是长期维护型模型系统，而不是一次性实验，TensorFlow 的体系化优势会更明显。",
          ],
          bodyEn: [
            "TensorFlow is more than a training library; it is a broad ecosystem for model engineering.",
            "Its value grows in long-lived systems rather than one-off experiments.",
          ],
        },
        {
          titleZh: "适合什么项目",
          titleEn: "What Projects It Fits",
          bodyZh: [
            "适合训练、部署、服务化链路比较完整的项目，也适合需要和成熟企业工程流程结合的团队。",
            "当项目强调标准化、可维护性和多阶段交付时，这类完整生态往往比单一训练体验更重要。",
          ],
          bodyEn: [
            "It fits projects that need end-to-end training, serving, and operational maturity.",
            "Teams that value standardization and maintainability often benefit most from this broader ecosystem.",
          ],
        },
        {
          titleZh: "核心模块怎么看",
          titleEn: "How to View the Core Modules",
          bodyZh: [
            "可以从数据输入、模型定义、训练循环、导出部署四层来理解。每一层都不是独立存在的，最终目标是把实验结果稳定带到线上。",
            "理解这几个环节之间的衔接方式，比单纯会写一个训练脚本更重要。",
          ],
          bodyEn: [
            "A useful view is data input, model definition, training loop, and export/deployment.",
            "Knowing how these layers connect matters more than writing a training script in isolation.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "实战里建议先从一个清晰任务做最小闭环，例如分类或回归，从数据读取到模型导出全部跑通。",
            "等闭环稳定后，再引入更复杂的模型结构、监控、版本管理和线上服务化，避免把学习曲线和工程复杂度叠在一起。",
          ],
          bodyEn: [
            "Start with a small closed loop from data loading to model export on one clear task.",
            "Add complexity such as monitoring, versioning, and serving only after the basic path is stable.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题是直接上复杂教程，却没有先建立基础数据流和部署流认知。这样训练能跑，但工程化会很吃力。",
            "另一个问题是过度追求框架全面性，在任务还很简单时就提前引入过多结构。",
          ],
          bodyEn: [
            "A common mistake is jumping into complex examples before understanding the basic data and deployment flow.",
            "Another is over-engineering early because the framework supports many advanced patterns.",
          ],
        },
      ],
    },
    pytorch: {
      summaryZh: "PyTorch 更偏研究、原型和快速实验，适合先把模型思路验证清楚，再考虑更重的工程化问题。",
      summaryEn: "PyTorch is especially common in research and prototyping where iteration speed and flexibility matter.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "PyTorch 的上手体验通常更直观，尤其适合用来快速验证模型结构、训练策略和实验假设。",
            "对于开发者来说，它最大的优势是反馈快，改一个结构后能较快看到实验结果变化。",
          ],
          bodyEn: [
            "PyTorch often feels more direct when validating model structures, training strategies, and hypotheses.",
            "Fast feedback is one of its strongest advantages for experimentation-heavy work.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "它适合原型验证、研究迭代、模型结构探索和需要频繁改动实验逻辑的场景。",
            "如果你还在摸索模型路线，而不是已经确定一条长期生产方案，PyTorch 往往更灵活。",
          ],
          bodyEn: [
            "It fits prototyping, research iteration, architecture exploration, and rapidly changing experiment logic.",
            "It is especially useful before a long-term production path has fully stabilized.",
          ],
        },
        {
          titleZh: "工作方式有什么特点",
          titleEn: "What Makes the Workflow Distinct",
          bodyZh: [
            "它更适合边写边试、边改边看，很多研究和实验型团队会用它先把核心思路跑通。",
            "这种工作方式的优点是灵活，代价是如果后续要大规模部署，仍然需要再补工程层面的规范和管理。",
          ],
          bodyEn: [
            "Its workflow supports iterative experimentation and quick adjustment.",
            "That flexibility is powerful, but production deployment still requires later engineering discipline.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "先选一个小任务，把数据、训练、验证和结果比较做扎实，不要一开始就追求大模型或大数据量。",
            "实验记录也要尽早养成习惯，否则到后面很难知道哪次改动真正带来了提升。",
          ],
          bodyEn: [
            "Choose a small task first and make data, training, validation, and comparison rigorous.",
            "Keep experiment records early so improvements can be traced reliably.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题是沉迷于模型结构调整，却忽略数据质量和评估方法。很多时候实验不稳定并不是模型层的问题。",
            "另一个问题是原型一旦跑通，就误以为上线也会同样简单，结果后续补工程能力时成本很高。",
          ],
          bodyEn: [
            "A common mistake is obsessing over architecture while ignoring data quality or evaluation rigor.",
            "Another is assuming a working prototype automatically translates into easy production deployment.",
          ],
        },
      ],
    },
    "scikit-learn": {
      summaryZh: "Scikit-learn 是传统机器学习的高效起点，适合结构化数据场景下快速建立可解释、可比较的基线方案。",
      summaryEn:
        "Scikit-learn is a practical starting point for classical ML tasks such as classification, regression, clustering, and feature work.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Scikit-learn 的价值在于简单、稳、覆盖面广。对于很多结构化数据任务，它往往比一上来用深度学习更有效率。",
            "如果你需要先建立一个清晰基线，再决定要不要上更重的模型，这通常是最合适的起点。",
          ],
          bodyEn: [
            "Scikit-learn is valuable because it is broad, stable, and efficient for structured-data tasks.",
            "It is often the best first baseline before considering heavier model families.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "它适合分类、回归、聚类、特征筛选、模型比较和传统预测任务，尤其适合表格型数据。",
            "当数据规模适中、解释性要求较高时，它的性价比通常非常高。",
          ],
          bodyEn: [
            "It fits classification, regression, clustering, feature selection, and structured prediction work.",
            "Its value is especially strong when scale is moderate and explainability matters.",
          ],
        },
        {
          titleZh: "配置与实验重点",
          titleEn: "Configuration and Experiment Focus",
          bodyZh: [
            "使用重点通常不在复杂网络结构，而在数据清洗、特征工程、交叉验证和指标选择。",
            "很多项目真正拉开效果差距的地方，是数据表达和评估设计，而不是模型名字本身。",
          ],
          bodyEn: [
            "The focus is often on cleaning, feature engineering, cross-validation, and metric choice rather than deep architectures.",
            "Performance differences frequently come from data representation and evaluation design.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "先做一个最朴素的基线模型，再逐步比较不同算法和参数，而不是一开始就追求最复杂方案。",
            "只要基线明确，后面无论是继续优化传统方法还是升级到更复杂模型，决策都会更有依据。",
          ],
          bodyEn: [
            "Build a simple baseline first, then compare algorithms and parameters incrementally.",
            "A strong baseline makes later optimization or framework upgrades far more rational.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见坑包括数据泄漏、划分不规范、指标和业务目标不匹配，以及只看单次结果不看稳定性。",
            "还有一种误区是觉得传统方法“太老”，但很多业务其实根本不需要更复杂的模型。",
          ],
          bodyEn: [
            "Typical pitfalls include data leakage, poor train-test splits, and metrics that do not match business goals.",
            "Another mistake is dismissing classical methods when they may already be sufficient.",
          ],
        },
      ],
    },
    opencv: {
      summaryZh: "OpenCV 适合基础图像处理、视觉前处理和经典视觉任务，常常是视觉系统里最先落地的一层。",
      summaryEn: "OpenCV is useful for image processing, vision pre-processing, and classic computer-vision tasks.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "OpenCV 更像视觉系统的基础工具箱。它不强调语言理解或生成，而是先解决图像怎么读、怎么裁、怎么变换、怎么提取基础信息。",
            "很多视觉项目最开始并不需要大模型，先用经典方法把输入处理稳住，往往是更合理的顺序。",
          ],
          bodyEn: [
            "OpenCV is a core toolbox for image-level processing and classic visual operations.",
            "Many vision systems benefit from stabilizing input processing before adding heavier models.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "它适合图像裁剪、滤波、增强、边缘检测、模板匹配、摄像头读取和视觉前处理。",
            "当任务目标是把原始图像变成更干净、更可分析的输入时，它尤其好用。",
          ],
          bodyEn: [
            "It fits cropping, filtering, enhancement, edge detection, template matching, camera input, and pre-processing.",
            "It is especially useful when the first job is making raw images easier to analyze.",
          ],
        },
        {
          titleZh: "工程里怎么用",
          titleEn: "How It Is Used in Practice",
          bodyZh: [
            "工程里常见做法是先用 OpenCV 做清洗和结构处理，再把结果交给 OCR、检测模型或后续业务逻辑。",
            "这类前处理如果做得稳，后面模型层的压力通常会小很多。",
          ],
          bodyEn: [
            "A common pattern is using OpenCV before OCR, detection models, or downstream business logic.",
            "Stable pre-processing often reduces later model burden significantly.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "建议先围绕一类图像输入建立固定流水线，例如灰度化、裁剪、降噪、阈值化，再验证后续任务效果是否提升。",
            "不要一开始就追求“万能视觉处理”，先把一种输入做稳更重要。",
          ],
          bodyEn: [
            "Build a stable pipeline for one image type first, then verify whether downstream quality improves.",
            "It is better to make one input class reliable than chase universal processing too early.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题是参数全靠手调，却没有建立针对不同输入条件的验证样本，结果一换图片就失效。",
            "另一个问题是把所有视觉任务都想靠规则完成，忽略了复杂语义场景其实需要模型能力。",
          ],
          bodyEn: [
            "One common problem is hand-tuned parameters without representative validation sets.",
            "Another is forcing rules to solve tasks that actually require learned semantic understanding.",
          ],
        },
      ],
    },
    selenium: {
      summaryZh: "Selenium 适合浏览器自动化和跨环境回归流程，尤其适合需要兼顾旧系统和真实浏览器行为的场景。",
      summaryEn: "Selenium supports browser automation and regression flows, especially for legacy-heavy or cross-environment browser workflows.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Selenium 更偏浏览器驱动和自动化执行层，适合需要真实点击、输入、等待和页面跳转的流程。",
            "它不是只做测试，也常被拿来做后台批处理、自动化录入和兼容性回归。",
          ],
          bodyEn: [
            "Selenium sits close to the browser-driving execution layer for real clicks, inputs, waits, and navigation.",
            "It is used not only for testing but also for admin automation and compatibility workflows.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "适合表单操作、后台流程回归、旧系统自动化、跨浏览器检查和必须基于真实浏览器运行的脚本。",
            "当目标页面无法通过简单接口处理，或对浏览器行为本身有依赖时，这类工具就很有必要。",
          ],
          bodyEn: [
            "It fits forms, admin regressions, legacy systems, cross-browser checks, and scripts that rely on real browser behavior.",
            "It becomes necessary when a page cannot be handled through simple APIs alone.",
          ],
        },
        {
          titleZh: "配置与维护重点",
          titleEn: "Configuration and Maintenance Focus",
          bodyZh: [
            "配置时要重点关注浏览器驱动、版本匹配、元素定位方式和等待策略。真正难的通常不是写第一版脚本，而是让脚本在页面变化后还能继续稳定。",
            "所以稳定的选择器和清晰的页面状态判断，比堆更多步骤更重要。",
          ],
          bodyEn: [
            "Driver versions, element selectors, and wait strategy are the main setup concerns.",
            "The hard part is not writing the first script but keeping it stable as the UI evolves.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "建议先从一个高频、固定路径的页面流程开始，例如登录后执行一段后台操作，并把每一步状态判断写清楚。",
            "流程越清晰、断点越明确，后面维护成本越低。",
          ],
          bodyEn: [
            "Start from one high-frequency, fixed-path browser flow and define state checks clearly for each step.",
            "Clear flow boundaries make later maintenance much cheaper.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "最常见的坑是用过于脆弱的 XPath 或样式选择器，页面一微调脚本就坏。另一个坑是完全依赖固定睡眠时间，导致脚本又慢又不稳。",
            "如果没有把等待机制、异常处理和截图日志做好，后面定位失败点会非常痛苦。",
          ],
          bodyEn: [
            "Fragile selectors and fixed sleep-based timing are among the most common failure causes.",
            "Without solid waits, error handling, and logs, debugging becomes unnecessarily painful.",
          ],
        },
      ],
    },
    playwright: {
      summaryZh: "Playwright 更适合现代前端自动化和页面验收，优势在于调试体验、断言体系和多浏览器一致性。",
      summaryEn: "Playwright is strong for modern frontend automation and verification, especially around page flows, assertions, and debugging.",
      sections: [
        {
          titleZh: "入门定位",
          titleEn: "Getting Started Positioning",
          bodyZh: [
            "Playwright 更像现代前端项目的自动化验收工具箱。它不只是驱动浏览器，还很强调调试、录制、断言和脚本维护体验。",
            "如果项目本身是 React、Next.js 这类现代站点，它通常比老一代浏览器自动化方案更顺手。",
          ],
          bodyEn: [
            "Playwright is a modern automation and verification toolkit for frontend-heavy projects.",
            "It combines browser control with strong debugging and assertion ergonomics.",
          ],
        },
        {
          titleZh: "适合什么场景",
          titleEn: "Best-Fit Scenarios",
          bodyZh: [
            "适合关键用户流程验收、页面截图检查、真实交互自动化、端到端测试和发布前回归。",
            "只要你希望把“用户真的能走通页面”这件事稳定验证下来，它就很有价值。",
          ],
          bodyEn: [
            "It fits critical user-flow verification, screenshot checks, real interaction automation, end-to-end tests, and release regression.",
            "It is especially valuable when real page completion needs to be proven repeatedly.",
          ],
        },
        {
          titleZh: "为什么常被优先选择",
          titleEn: "Why It Is Often Preferred",
          bodyZh: [
            "它的等待机制、调试信息、多浏览器支持和定位器设计通常更适合现代页面，尤其是在异步渲染和复杂交互场景里。",
            "比起只看脚本能不能跑，它更强调脚本是否可维护、是否容易回放和定位问题。",
          ],
          bodyEn: [
            "Its waits, locators, debugging signals, and multi-browser support fit modern asynchronous interfaces well.",
            "It emphasizes maintainability and debuggability, not just raw script execution.",
          ],
        },
        {
          titleZh: "实战建议",
          titleEn: "Practical Advice",
          bodyZh: [
            "建议先围绕一条关键路径建立自动化，例如首页进入、登录、核心操作和成功提示，再逐步扩展到更多页面。",
            "如果验收目标明确，Playwright 很适合成为发布前的最后一道真实页面保障。",
          ],
          bodyEn: [
            "Start with one critical path such as landing, sign-in, core action, and success confirmation.",
            "With clear acceptance targets, it works well as the final real-page gate before release.",
          ],
        },
        {
          titleZh: "常见坑",
          titleEn: "Common Pitfalls",
          bodyZh: [
            "常见问题是把它当成纯脚本执行器，而没有写足够断言，导致脚本跑完却不能说明页面真的正确。",
            "另一个问题是测试范围铺得太大，结果执行时间很长，失败点很多，却没有优先级。",
          ],
          bodyEn: [
            "One mistake is treating it as a click script without enough assertions to prove correctness.",
            "Another is expanding coverage too broadly before the most important flows are stable and prioritized.",
          ],
        },
      ],
    },
  };

  const tutorialAdditions: Record<string, EditableDocItem["sections"]> = {
    "ai-agent": [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "最适合的第一个例子不是全能助手，而是一个短链路任务，例如“读取网页并整理 5 条要点”或“扫描仓库并列出 3 个风险点”。",
          "这个例子要满足三件事：目标明确、结果可检查、失败后知道哪一步出错。只要这三件事满足，你就能真正学会 Agent 的执行逻辑。",
        ],
        bodyEn: [
          "The best first example is not a general assistant but a short-loop task such as summarizing a page or listing repository risks.",
          "The example should have a clear goal, a checkable result, and failure points that can be located precisely.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议顺序是：普通模型调用 -> 单步工具调用 -> 带状态的多步任务 -> 检索增强 -> 长时任务 -> 多智能体协作。",
          "不要把学习顺序倒过来。越早引入复杂协调，越容易把问题归咎于“模型不稳定”，而不是自己的系统设计还没站稳。",
        ],
        bodyEn: [
          "A practical order is model calls, single-step tool use, stateful multi-step execution, retrieval, long-running tasks, and then multi-agent collaboration.",
          "Reversing that order usually hides design weaknesses behind claims of model instability.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "Agent 往往不是单独存在的，它会和 LangChain、Skills、Playwright、检索系统或代码代理一起使用。",
          "比较稳的组合方式是：先用 Skills 固定流程，再用 LangChain 组织链路，最后只在真正需要自主决策的地方引入 Agent。",
        ],
        bodyEn: [
          "Agents usually work together with Skills, LangChain, Playwright, retrieval systems, or coding agents rather than standing alone.",
          "A stable pattern is to fix the workflow with Skills, orchestrate the pipeline with LangChain, and only add autonomous decisions where truly needed.",
        ],
      },
    ],
    "ai-basics": [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "第一个例子最好选一个最小 AI 应用，例如文本分类、固定格式摘要或简单问答，不要一开始就做复杂助手。",
          "关键不是模型多先进，而是你能清楚描述输入是什么、输出应该长什么样、结果怎么验证。",
        ],
        bodyEn: [
          "Your first example should be a minimal AI application such as text classification, fixed-format summarization, or simple QA.",
          "The key is not model sophistication but clarity about the input, output shape, and validation method.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议先学输入输出，再学模型，再学系统。具体可以按“任务定义 -> 数据准备 -> 模型调用 -> 结果验证 -> 系统接入”的顺序走。",
          "这样学的好处是，每往下一步，你都知道前一层为什么存在，而不是只在记概念。",
        ],
        bodyEn: [
          "Start with task definition and I/O, then models, then systems.",
          "A good order is task definition, data preparation, model call, result validation, and system integration.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "AI 基础认知是后面所有内容的底层：机器学习帮助你理解训练和泛化，NLP 帮你理解文本任务，Agent 帮你理解执行系统。",
          "如果这层不稳，后面看 Codex、LangChain 或本地模型时，容易只会用，不知道为什么这样用。",
        ],
        bodyEn: [
          "AI fundamentals sit underneath later topics such as machine learning, NLP, agents, and orchestration.",
          "Without this layer, later tools are easy to use mechanically but hard to reason about correctly.",
        ],
      },
    ],
    "machine-learning": [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "最适合的新手例子通常是一个结构化数据分类或回归任务，例如用户流失预测、分数预测或简单标签分类。",
          "这个例子的目标不是追求最高分，而是把“数据清洗 -> 特征准备 -> 训练 -> 验证 -> 对比”完整走一遍。",
        ],
        bodyEn: [
          "A beginner-friendly example is usually a structured-data classification or regression task.",
          "The goal is not the highest score but completing the full loop of cleaning, features, training, validation, and comparison.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议顺序是：先理解数据切分和评价指标，再做基线模型，然后学特征工程，最后再接触复杂模型和上线监控。",
          "如果一开始就跳到复杂模型，往往会错过机器学习里最核心的判断能力。",
        ],
        bodyEn: [
          "A practical order is data splits and metrics first, then baselines, then feature engineering, and only later complex models and monitoring.",
          "Jumping straight to complex models usually skips the most important judgment layer in ML.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "机器学习和 scikit-learn、PyTorch、TensorFlow 是强关联主题。前者讲原理和判断，后者分别对应不同的工程工具路径。",
          "你可以先学机器学习的实验逻辑，再根据任务类型决定走传统方法、研究原型还是完整训练生态。",
        ],
        bodyEn: [
          "Machine learning connects strongly with scikit-learn, PyTorch, and TensorFlow.",
          "Learn the experiment logic first, then choose between classical methods, research prototyping, or full training ecosystems.",
        ],
      },
    ],
    nlp: [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "第一个 NLP 例子最好选边界明确的任务，例如情感分类、关键词抽取或固定格式摘要。",
          "不要一开始就做开放式对话系统，因为那会同时叠加任务定义、上下文管理和评估困难。",
        ],
        bodyEn: [
          "A good first NLP example is a tightly scoped task such as sentiment classification, keyword extraction, or fixed-format summarization.",
          "Open-ended dialogue is a poor starting point because it stacks too many hard problems at once.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议先学分类和抽取，再学检索和生成，最后再碰对话和复杂问答。",
          "因为前面的任务更容易定义输出标准，而输出标准越清楚，评估和优化就越容易。",
        ],
        bodyEn: [
          "Start with classification and extraction, then move to retrieval and generation, and only later attempt dialogue or complex QA.",
          "Early tasks are easier to evaluate because their output standards are clearer.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "NLP 常和 LangChain、RAG、向量检索和 Agent 结合。文本任务一旦进入真实系统，往往不只是“生成一句话”，而是要接入检索、约束输出和做后处理。",
          "所以学 NLP 时，最好同步理解系统层要怎么接住模型输出。",
        ],
        bodyEn: [
          "NLP often combines with LangChain, RAG, vector retrieval, and agents.",
          "Once text tasks enter real systems, they usually need retrieval, output constraints, and post-processing rather than pure generation.",
        ],
      },
    ],
    "codex-tutorial": [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "最适合的第一个 Codex 任务是一个可验证的小改动，例如修一个按钮逻辑、补一个接口字段或修一个构建错误。",
          "只要任务能明确说出“改哪里、改完怎么验”，你就能直观看到 Codex 和普通问答模型的差别。",
        ],
        bodyEn: [
          "A good first Codex task is a small verifiable change such as fixing a button flow, adding an API field, or resolving a build failure.",
          "If the task clearly states where to change and how to validate, the difference from plain Q&A becomes obvious.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议先做单文件修复，再做多文件功能补充，然后再做部署、审查和较大的页面改造。",
          "这样可以逐步建立你和代理之间的协作节奏，而不是一开始就让它承担太大范围。",
        ],
        bodyEn: [
          "Start with single-file fixes, then multi-file features, and only later move into deployment, review, and larger interface changes.",
          "That order helps you build a stable collaboration rhythm with the agent.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "Codex 常和 Skills、代码审查流程、Playwright 验收、部署脚本和 Agent 工作流结合。",
          "比较稳的方式是：用 Skills 固定方法，用 Codex 执行改动，用 Playwright 或 build/lint 做验证。",
        ],
        bodyEn: [
          "Codex often combines with Skills, code review flows, Playwright verification, deployment scripts, and agent workflows.",
          "A stable pattern is to use Skills for method, Codex for execution, and build or browser checks for validation.",
        ],
      },
    ],
    "claude-code": [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "第一个例子最好是“读懂一个仓库或模块”，例如让它总结某个目录职责、接口流向和技术债，而不是直接要求它做复杂修改。",
          "这样你能先体验它在长上下文归纳上的优势，再决定后面怎么把分析接到执行里。",
        ],
        bodyEn: [
          "A strong first example is asking it to explain a repository or module rather than making it jump straight into complex edits.",
          "That lets you experience its long-context synthesis strengths before connecting analysis to execution.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议顺序是：先做仓库讲解，再做迁移/重构分析，然后再让它生成说明文档或改造计划。",
          "不要先要求它产出非常细的技术方案，而你自己还没确认当前系统边界。",
        ],
        bodyEn: [
          "A good order is repository explanation first, then migration or refactor analysis, then documentation and implementation plans.",
          "Do not ask for highly detailed plans before the current system boundaries are understood.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "Claude Code 很适合和 Codex 搭配：前者负责把复杂上下文讲清楚，后者负责把改动真正落到仓库里。",
          "如果你的任务既复杂又需要落地，这种“先理解后执行”的组合通常比只用一个代理更稳。",
        ],
        bodyEn: [
          "Claude Code pairs well with Codex: one clarifies complex context while the other lands the actual repository changes.",
          "For hard tasks that also need execution, this understand-then-ship pattern is often more stable.",
        ],
      },
    ],
    opencode: [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "第一个例子最好是接入一个固定能力，例如读取项目文件、执行一个受控命令，或调用一个私有接口，而不是一上来就做全套平台。",
          "这样能先验证 OpenCode 的开放性在你当前环境里有没有真实价值。",
        ],
        bodyEn: [
          "A good first example is wiring one controlled capability such as reading project files, executing a fixed command, or calling a private API.",
          "That validates whether OpenCode's openness creates real value in your environment.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议顺序是：先接一个能力，再补权限，再做日志和失败处理，最后再扩展多模型和多工作流。",
          "如果把灵活性放在控制层前面，系统几乎一定会很快失控。",
        ],
        bodyEn: [
          "A safe order is one capability first, then permissions, then logging and failure handling, and only later multi-model or multi-workflow expansion.",
          "If flexibility arrives before control layers, the system will usually become unstable quickly.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "OpenCode 常和 Skills、私有工具、部署流水线和内部安全规则结合。",
          "它更像一个让你把这些现有能力组织起来的外层，而不是替代原本的工程规范。",
        ],
        bodyEn: [
          "OpenCode often combines with Skills, private tools, deployment pipelines, and internal security rules.",
          "It acts more like an outer organizer of existing capabilities than a replacement for engineering standards.",
        ],
      },
    ],
    skills: [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "第一个 Skill 最好针对一个高频、重复、可验证的任务，例如“做多文件功能时先切片再验证”或“修 CI 时先查日志再定位根因”。",
          "只要这个 Skill 真能在 2 到 3 个真实任务里减少返工，它就值得保留和继续扩展。",
        ],
        bodyEn: [
          "The first skill should target one frequent, repeatable, and verifiable task.",
          "If it reduces rework across two or three real tasks, it is worth keeping and expanding.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议先写单一场景 Skill，再写相邻场景，最后再做路由型或组合型 Skill。",
          "不要一开始就做过于抽象的大 Skill，否则看起来什么都能管，实际上什么都管不好。",
        ],
        bodyEn: [
          "Start with single-scenario skills, then adjacent scenarios, and only later build routing or composition skills.",
          "Abstract mega-skills look powerful but usually fail to guide execution well.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "Skills 和 Codex、Claude Code、OpenCode、Agent 都能结合。它的作用不是代替模型，而是把协作方法固定下来。",
          "你可以把它理解成“给代理加工作制度”，这样同类任务每次都能走相近流程。",
        ],
        bodyEn: [
          "Skills combine naturally with Codex, Claude Code, OpenCode, and agent workflows.",
          "They do not replace the model; they stabilize the collaboration method around it.",
        ],
      },
    ],
    langchain: [
      {
        titleZh: "第一个例子怎么做",
        titleEn: "How to Build the First Example",
        bodyZh: [
          "最适合的第一个例子通常是一个最小链路，例如“检索一段资料再生成回答”或“调用工具后输出结构化 JSON”。",
          "不要一上来就做全能 Agent。先把一段短链路跑稳，才能知道框架到底在帮你什么。",
        ],
        bodyEn: [
          "A strong first example is a minimum chain such as retrieval plus answer generation or tool call plus structured JSON output.",
          "Do not begin with an all-purpose agent. First prove what the framework is actually helping with.",
        ],
      },
      {
        titleZh: "推荐学习顺序",
        titleEn: "Recommended Learning Order",
        bodyZh: [
          "建议顺序是：模型接入 -> 提示模板 -> 输出解析 -> 检索 -> 工具调用 -> 多步链路。",
          "这样每往前走一步，你都知道新增复杂度是为了解决什么问题，而不是为了“看起来更像 AI 系统”。",
        ],
        bodyEn: [
          "A practical order is model integration, prompt templates, output parsing, retrieval, tool calls, and then multi-step chains.",
          "That way every new layer solves a visible problem instead of existing only for appearance.",
        ],
      },
      {
        titleZh: "和其他主题怎么组合",
        titleEn: "How It Combines with Other Topics",
        bodyZh: [
          "LangChain 常和 NLP、RAG、Agent、向量检索和 Skills 结合。它更像连接器和编排器，而不是终点产品。",
          "比较稳的做法是：先用它串起模型与检索，再决定是否进一步引入 Agent 决策能力。",
        ],
        bodyEn: [
          "LangChain often combines with NLP, RAG, agents, vector retrieval, and Skills.",
          "A stable approach is to use it to connect models and retrieval first, then decide whether agent-style decision-making is actually needed.",
        ],
      },
    ],
  };

  return [
    ...categories,
    ...defaultDocItems.map((item) => ({
      ...item,
      parentSlug: categoryMap[item.slug] ?? item.parentSlug,
      ...(overrides[item.slug] ?? {}),
      sections: [
        ...(overrides[item.slug]?.sections ?? item.sections),
        ...(tutorialAdditions[item.slug] ?? []),
      ],
    })),
  ];
}

function buildDocTree(items: EditableDocItem[], lang: SiteLanguage) {
  const localized = new Map(items.map((item) => [item.slug, localizeDocNode(item, lang)]));
  const children = new Map<string | null, SiteDocNode[]>();

  for (const item of items) {
    const key = item.parentSlug ?? null;
    const list = children.get(key) ?? [];
    const node = localized.get(item.slug);
    if (node) {
      list.push(node);
      children.set(key, list);
    }
  }

  for (const item of items) {
    const node = localized.get(item.slug);
    if (node) {
      node.children = (children.get(item.slug) ?? []).sort((left, right) => {
        const sourceLeft = items.find((candidate) => candidate.slug === left.slug)?.sortOrder ?? 0;
        const sourceRight = items.find((candidate) => candidate.slug === right.slug)?.sortOrder ?? 0;
        return sourceLeft - sourceRight;
      });
    }
  }

  return (children.get(null) ?? []).sort((left, right) => {
    const sourceLeft = items.find((candidate) => candidate.slug === left.slug)?.sortOrder ?? 0;
    const sourceRight = items.find((candidate) => candidate.slug === right.slug)?.sortOrder ?? 0;
    return sourceLeft - sourceRight;
  });
}

function localizeHomeFeedItem(item: HomeFeedItem, lang: SiteLanguage): LocalizedHomeFeedItem {
  return {
    id: item.id,
    kind: item.kind,
    title: lang === "zh" ? item.titleZh : item.titleEn,
    summary: lang === "zh" ? item.summaryZh : item.summaryEn,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    externalUrl: item.externalUrl,
    publishedAt: item.publishedAt,
    heatScore: item.heatScore,
    tags: item.tags,
    coverImage: item.coverImage,
    metrics: item.metrics,
  };
}

function localizeHomeFeedSection(section: HomeFeedSection, lang: SiteLanguage): LocalizedHomeFeedSection {
  return {
    key: section.key,
    title: lang === "zh" ? section.titleZh : section.titleEn,
    updatedAt: section.updatedAt,
    featuredItem: section.featuredItem ? localizeHomeFeedItem(section.featuredItem, lang) : null,
    items: section.items.map((item) => localizeHomeFeedItem(item, lang)),
  };
}

function flattenDocs(tree: SiteDocNode[]) {
  const result: SiteDocNode[] = [];

  for (const node of tree) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenDocs(node.children));
    }
  }

  return result;
}

function ensureHomeFeedSnapshot(snapshot: HomeFeedSnapshot) {
  const parsed = homeFeedSnapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : CURATED_HOME_FEED_SNAPSHOT;
}

export function getSiteFooterData(lang: SiteLanguage): SiteFooterData {
  const beian = resolvePublicBeian("浙 ICP 备 2026043969 号-1");

  return {
    siteName: resolvePublicAppName("QiuAI WorkOS"),
    title: lang === "zh" ? "产品入口与联系" : "Product access and contact",
    description:
      lang === "zh"
        ? "QiuAI WorkOS 面向企业提供 Windows 桌面端、数字员工、数字工厂、模型配置、知识库和稳定产物交付。"
        : "QiuAI WorkOS provides Windows desktop execution, digital workers, digital factories, model configuration, knowledge bases, and artifact delivery for enterprise teams.",
    contacts: resolvePublicContactEmails(),
    footerLinks: [
      { label: lang === "zh" ? "下载" : "Downloads", value: "/downloads", href: `/downloads?lang=${lang}` },
      { label: lang === "zh" ? "指南" : "Guide", value: "/guide", href: `/guide?lang=${lang}` },
    ],
    beianText: beian.text,
    beianUrl: beian.url,
    publicSecurityBeianText: lang === "zh" ? "浙公网安备33052302001399号" : "Zhejiang Public Security Filing 33052302001399",
    publicSecurityBeianUrl: "https://beian.mps.gov.cn/",
  };
}

export async function getHomePageData(lang: SiteLanguage): Promise<HomePageData> {
  const safeFeedSnapshot = ensureHomeFeedSnapshot(CURATED_HOME_FEED_SNAPSHOT);
  const publicAppName = resolvePublicAppName(HOME_PAGE_COPY.titleZh);

  return {
    title: lang === "zh" ? HOME_PAGE_COPY.titleZh : HOME_PAGE_COPY.titleEn,
    eyebrow: lang === "zh" ? HOME_PAGE_COPY.titleZh : HOME_PAGE_COPY.titleEn,
    summary:
      lang === "zh"
        ? "这里整理我自己常用的 AI 工具、开发笔记、可下载文件和公开资料，页面结构尽量直接，减少无效跳转。"
        : "A practical public site for AI tools, programming notes, downloads, and curated reference material.",
    primaryActionLabel: lang === "zh" ? HOME_PAGE_COPY.primaryActionLabelZh : HOME_PAGE_COPY.primaryActionLabelEn,
    secondaryActionLabel:
      lang === "zh" ? HOME_PAGE_COPY.secondaryActionLabelZh : HOME_PAGE_COPY.secondaryActionLabelEn,
    positioning: [],
    feedGeneratedAt: dayjs(safeFeedSnapshot.generatedAt).format("YYYY-MM-DD"),
    feedSections: [
      localizeHomeFeedSection(safeFeedSnapshot.news, lang),
      localizeHomeFeedSection(safeFeedSnapshot.tech, lang),
      localizeHomeFeedSection(safeFeedSnapshot.github, lang),
    ],
    publicAppName,
  };
}

export async function getDownloadsPageData(lang: SiteLanguage): Promise<DownloadsPageData> {
  const items = await getManagedDownloadItems();
  const workosWindowsItem = await buildWorkosWindowsDownloadItem(lang);
  const otherItems = (items.length ? items : defaultResourceItems)
    .map((item) => ("projectName" in item ? localizeManagedDownloadItem(item, lang) : localizeResource(item, lang)))
    .filter((item) => item.slug !== workosWindowsItem.slug);

  return {
    title: lang === "zh" ? "下载 QiuAI WorkOS" : "Download QiuAI WorkOS",
    eyebrow: lang === "zh" ? "下载中心" : "Download Center",
    summary:
      lang === "zh"
        ? "获取 Windows 桌面客户端安装包。安装完成后，可按指南完成企业绑定、模型配置和任务使用。"
        : "Get the Windows desktop installer. After installation, follow the guide to bind your organization, configure models, and run tasks.",
    notes:
      lang === "zh"
        ? ["适用于 Windows 10/11 x64。", "安装后先绑定企业账号。", "再配置模型和知识库。"]
        : [
            "For Windows 10/11 x64.",
            "Bind the enterprise account after installation.",
            "Then configure models and knowledge.",
          ],
    items: [workosWindowsItem, ...otherItems],
  };
}

function buildWorkosGuideItems(): EditableDocItem[] {
  return [
    {
      slug: "getting-started",
      parentSlug: null,
      sortOrder: 10,
      titleZh: "快速开始",
      titleEn: "Quick Start",
      summaryZh: "从下载安装到完成第一次任务，按最短路径跑通 QiuAI WorkOS。",
      summaryEn: "Get from installation to your first completed task with the shortest path.",
      sections: [
        {
          titleZh: "准备工作",
          titleEn: "Preparation",
          bodyZh: [
            "准备一台 Windows 10/11 x64 电脑，确认可以访问企业控制台和模型供应商接口。",
            "如果你属于企业用户，先确认企业账号、套餐权限和设备绑定入口已经由管理员开通。",
          ],
          bodyEn: [
            "Prepare a Windows 10/11 x64 computer and make sure it can access the enterprise console and model provider APIs.",
            "For enterprise users, confirm that the organization account, plan permissions, and device binding entry are ready.",
          ],
        },
        {
          titleZh: "下载安装",
          titleEn: "Download And Install",
          bodyZh: [
            "进入下载页，下载最新的 QiuAI WorkOS Windows 客户端安装包。",
            "安装过程中如果系统提示未知发布者，可以先确认安装包来源为 qiuaihub.com，再继续安装。",
            "安装完成后从桌面或开始菜单启动 QiuAI WorkOS。",
          ],
          bodyEn: [
            "Open the downloads page and download the latest QiuAI WorkOS Windows installer.",
            "If Windows warns about an unknown publisher, verify that the installer comes from qiuaihub.com before continuing.",
            "After installation, start QiuAI WorkOS from the desktop shortcut or Start menu.",
          ],
        },
        {
          titleZh: "第一次使用",
          titleEn: "First Run",
          bodyZh: [
            "打开客户端后，先登录账号并绑定企业设备。",
            "进入模型配置，至少配置一个文本模型；如果要使用图片、视频或语音能力，再配置对应类型的模型。",
            "进入数字市场，安装一个数字员工或数字工厂，然后按界面提示上传文件、填写参数并发起任务。",
          ],
          bodyEn: [
            "After opening the client, sign in and bind the device to your organization.",
            "Configure at least one text model first. Add image, video, or speech models when those capabilities are needed.",
            "Open the digital marketplace, install a digital worker or factory, then upload files, fill parameters, and start a task.",
          ],
        },
      ],
    },
    {
      slug: "model-configuration",
      parentSlug: null,
      sortOrder: 20,
      titleZh: "模型配置",
      titleEn: "Model Configuration",
      summaryZh: "配置模型供应商、自定义兼容接口、拉取模型，并在数字员工和数字工厂中切换模型槽位。",
      summaryEn: "Configure providers, custom compatible APIs, model discovery, and model slots used by workers and factories.",
      sections: [
        {
          titleZh: "模型供应商",
          titleEn: "Providers",
          bodyZh: [
            "客户端支持按供应商保存模型配置，例如阿里云、腾讯云以及自定义兼容接口。",
            "自定义兼容接口适合接入第三方中转平台。填写 API 地址、API Key、模型名称和能力类型后，先点击测试模型。",
          ],
          bodyEn: [
            "The client stores model settings by provider, such as Alibaba Cloud, Tencent Cloud, and custom compatible APIs.",
            "Custom compatible APIs are for third-party gateways. Fill the API base URL, API key, model name, and capability type, then test the model first.",
          ],
        },
        {
          titleZh: "模型能力",
          titleEn: "Capabilities",
          bodyZh: [
            "常用能力包括文本模型、图片理解模型、生图模型、参考图编辑模型、视频模型和语音模型。",
            "节点只关心输入输出能力是否匹配。比如文本输入输出节点可以切换任意已配置的文本模型；生图节点可以切换输出图片的模型。",
          ],
          bodyEn: [
            "Common capabilities include text, image understanding, image generation, reference image editing, video, and speech models.",
            "Nodes care about input and output compatibility. A text-in/text-out node can use any configured text model; an image generation node can use models that output images.",
          ],
        },
        {
          titleZh: "拉取与测试",
          titleEn: "Discover And Test",
          bodyZh: [
            "配置供应商后，可以拉取模型列表，并按名称、能力、供应商筛选模型。",
            "如果测试模型超时，优先检查 API 地址、网络连通性、密钥权限和模型名称是否正确。",
          ],
          bodyEn: [
            "After configuring a provider, discover models and filter them by name, capability, and provider.",
            "If model testing times out, check the API URL, network connectivity, key permissions, and model name first.",
          ],
        },
      ],
    },
    {
      slug: "digital-workers",
      parentSlug: null,
      sortOrder: 30,
      titleZh: "数字员工",
      titleEn: "Digital Workers",
      summaryZh: "数字员工适合对话式任务，例如文档整理、表格整理、会议纪要和文案生成。",
      summaryEn: "Digital workers are for conversational tasks such as document cleanup, spreadsheet cleanup, meeting notes, and copywriting.",
      sections: [
        {
          titleZh: "安装数字员工",
          titleEn: "Install A Worker",
          bodyZh: [
            "进入数字市场，选择需要的数字员工。免费员工会显示免费标签，企业员工需要企业权限才能安装。",
            "现在可以先安装再配置。缺少模型或知识库时，客户端会在使用前提示你补齐配置。",
          ],
          bodyEn: [
            "Open the digital marketplace and choose a worker. Free workers are labeled as free; enterprise workers require organization permissions.",
            "You can install first and configure later. The client will prompt for missing model or knowledge settings before use.",
          ],
        },
        {
          titleZh: "发起任务",
          titleEn: "Start A Task",
          bodyZh: [
            "数字员工以对话方式接收任务。输入你的要求，按需要上传 TXT、PDF、Word、Excel、CSV、图片或音视频文件。",
            "任务执行中可以查看日志，完成后在产物区下载生成文件。",
          ],
          bodyEn: [
            "Digital workers accept requests through chat. Type the requirement and upload TXT, PDF, Word, Excel, CSV, image, audio, or video files when needed.",
            "View logs while the task is running. Download generated files from the artifact area after completion.",
          ],
        },
        {
          titleZh: "卸载重装",
          titleEn: "Uninstall And Reinstall",
          bodyZh: [
            "如果模板或配置更新后需要重新安装，进入数字员工详情，点击卸载，再从数字市场重新安装。",
            "卸载只影响本机安装状态，不会删除企业市场中的模板。",
          ],
          bodyEn: [
            "If a template or configuration has changed, open the worker details, uninstall it, then reinstall from the marketplace.",
            "Uninstalling only changes the local installation state. It does not remove the template from the enterprise marketplace.",
          ],
        },
      ],
    },
    {
      slug: "digital-factories",
      parentSlug: null,
      sortOrder: 40,
      titleZh: "数字工厂",
      titleEn: "Digital Factories",
      summaryZh: "数字工厂适合批量化、参数化、可审查的流程，例如跨境商品图生成和视频质检剪辑。",
      summaryEn: "Digital factories are for batch, parameterized, reviewable workflows such as product image generation and video QA/editing.",
      sections: [
        {
          titleZh: "界面结构",
          titleEn: "Interface",
          bodyZh: [
            "数字工厂不是对话式界面。左侧上传文件和设置参数，中间查看任务队列和输出队列，右侧查看模型状态和工作日志。",
            "窗口宽度不足时，模型状态和工作日志会收进侧边栏，避免主工作区被挤压。",
          ],
          bodyEn: [
            "A digital factory is not a chat interface. Upload files and set parameters on the left, review task and output queues in the center, and inspect model status and logs on the right.",
            "When the window is narrow, model status and logs collapse into a side panel so the main workspace stays usable.",
          ],
        },
        {
          titleZh: "输出队列",
          titleEn: "Output Queue",
          bodyZh: [
            "输出队列展示产物和每一个可审查输出物。图片可以看缩略图，视频可以打开本地播放器预览。",
            "审核员可以对输出物修改状态、删除无效项、单个下载或打包下载。",
          ],
          bodyEn: [
            "The output queue shows final artifacts and each reviewable output item. Images show thumbnails, and videos can open in the local player.",
            "Reviewers can edit status, delete invalid items, download individual files, or package outputs.",
          ],
        },
        {
          titleZh: "典型工厂",
          titleEn: "Common Factories",
          bodyZh: [
            "跨境商品图工厂适合批量生成主图、白底图、尺寸图、场景图、换背景、换模特等商品图片。",
            "视频质检剪辑工厂适合按筛选标准处理视频，输出合格视频清单，并可按需生成初剪产物。",
          ],
          bodyEn: [
            "The cross-border product image factory generates main images, white-background images, size diagrams, scenes, background replacements, and model changes.",
            "The video QA/editing factory screens videos by rules, outputs qualified video lists, and can generate rough-cut outputs when enabled.",
          ],
        },
      ],
    },
    {
      slug: "knowledge-base",
      parentSlug: null,
      sortOrder: 50,
      titleZh: "知识库",
      titleEn: "Knowledge Base",
      summaryZh: "本地知识库和企业知识库会在任务执行时合并使用，帮助模型结合企业资料回答和处理文件。",
      summaryEn: "Local and enterprise knowledge bases are merged during task execution so models can use company context.",
      sections: [
        {
          titleZh: "本地知识库",
          titleEn: "Local Knowledge",
          bodyZh: [
            "本地知识库由当前设备维护，可以上传一份完整 PDF 作为本机知识资产。",
            "本地知识库可以为空，适合保存只在当前设备使用的补充资料。",
          ],
          bodyEn: [
            "Local knowledge is maintained on the current device. Upload one complete PDF as the device-level knowledge asset.",
            "Local knowledge can be empty and is suitable for device-only reference material.",
          ],
        },
        {
          titleZh: "企业知识库",
          titleEn: "Enterprise Knowledge",
          bodyZh: [
            "企业知识库由 web-console 维护，上传完整企业 PDF 文档后，企业绑定设备可以同步使用。",
            "企业资料建议包括企业基础信息、产品资料、服务政策、销售话术和常见问题。",
          ],
          bodyEn: [
            "Enterprise knowledge is maintained in web-console. After uploading a complete enterprise PDF, bound devices can sync and use it.",
            "Recommended content includes company profile, product information, service policies, sales scripts, and FAQs.",
          ],
        },
        {
          titleZh: "任务调用",
          titleEn: "Task Usage",
          bodyZh: [
            "数字员工和数字工厂调用知识库时，会合并本地知识库和企业知识库。",
            "如果任务不需要知识库，可以在模板或配置中关闭对应能力，减少无关信息干扰。",
          ],
          bodyEn: [
            "When workers or factories use knowledge, local and enterprise knowledge are merged.",
            "If a task does not need knowledge, disable the capability in the template or configuration to reduce irrelevant context.",
          ],
        },
      ],
    },
    {
      slug: "troubleshooting",
      parentSlug: null,
      sortOrder: 60,
      titleZh: "常见问题",
      titleEn: "Troubleshooting",
      summaryZh: "处理安装、登录、模型连接、产物生成和任务失败等常见问题。",
      summaryEn: "Resolve common issues around installation, sign-in, model connectivity, artifacts, and task failures.",
      sections: [
        {
          titleZh: "安装和启动",
          titleEn: "Installation And Startup",
          bodyZh: [
            "如果安装后白屏，优先确认已安装最新版本；旧版本可能因为本地资源路径错误导致界面无法加载。",
            "如果卸载后文件删不掉，先确认 QiuAI WorkOS 进程已经退出，再重新执行卸载或覆盖安装。",
          ],
          bodyEn: [
            "If the app shows a blank screen after installation, first make sure the latest version is installed; older versions may fail to load local renderer assets.",
            "If files remain after uninstalling, make sure the QiuAI WorkOS process has exited, then uninstall again or install over it.",
          ],
        },
        {
          titleZh: "模型连接失败",
          titleEn: "Model Connection Failed",
          bodyZh: [
            "检查 API 地址是否包含正确路径，API Key 是否有效，模型名称是否与供应商后台一致。",
            "如果供应商后台没有请求记录，通常说明请求还没发出去，优先检查本地模型配置和节点能力匹配。",
          ],
          bodyEn: [
            "Check whether the API URL includes the correct path, the API key is valid, and the model name matches the provider console.",
            "If the provider console has no request log, the request likely did not leave the client. Check local model settings and node capability matching first.",
          ],
        },
        {
          titleZh: "任务失败和反馈",
          titleEn: "Task Failure And Feedback",
          bodyZh: [
            "任务失败时，打开客户端日志查看失败节点、输入输出和原始错误。",
            "如果无法自行判断，使用问题反馈提交现象、任务日志和必要截图，管理员可在后台问题消息中查看。",
          ],
          bodyEn: [
            "When a task fails, open the client logs to inspect the failed node, inputs, outputs, and raw error.",
            "If you cannot diagnose it, submit feedback with symptoms, task logs, and screenshots. Administrators can review it in issue messages.",
          ],
        },
      ],
    },
  ];
}

export async function getDocsPageData(lang: SiteLanguage, docSlug?: string): Promise<DocsPageData> {
  const tree = buildDocTree(buildWorkosGuideItems(), lang);
  const flattened = flattenDocs(tree);
  const activeDoc =
    flattened.find((item) => item.slug === docSlug) ??
    flattened.find((item) => item.slug === "getting-started") ??
    tree[0];

  return {
    title: lang === "zh" ? "QiuAI WorkOS 使用指南" : "QiuAI WorkOS Guide",
    eyebrow: lang === "zh" ? "使用指南" : "Guide",
    summary:
      lang === "zh"
        ? "围绕安装、企业绑定、模型配置、数字员工、数字工厂、知识库和常见问题，帮助用户直接上手 QiuAI WorkOS。"
        : "Practical instructions for installation, organization binding, model setup, digital workers, digital factories, knowledge bases, and common issues.",
    notes:
      lang === "zh"
        ? ["先完成安装和企业绑定。", "再配置模型和知识库。", "最后安装数字员工或数字工厂。"]
        : ["Install and bind the organization first.", "Configure models and knowledge next.", "Then install workers or factories."],
    tree,
    activeDoc,
  };
}

export async function getDeveloperPageData(lang: SiteLanguage): Promise<DeveloperPageData> {
  return {
    profile: {
      name: defaultDeveloperProfile.name,
      role: lang === "zh" ? "独立开发者" : "Independent Developer",
      summary:
        lang === "zh"
          ? "主要做 AI 工具、桌面软件、自动化脚本，也记录自己在开发中踩过的坑和总结出的做法。"
          : "Focused on AI applications, workflow automation, desktop tools, and practical knowledge systems.",
      longBio:
        lang === "zh"
          ? "这里集中展示公开仓库、长期积累的技术判断，以及我对 AI 应用方向的持续整理。"
          : "This page collects public repositories, long-term technical notes, and my view on AI application work.",
      projects: DEVELOPER_REPOSITORY_GROUPS.project.slice(0, 2),
      email: defaultDeveloperProfile.email,
      location: defaultDeveloperProfile.location,
      websiteLabel: HOME_PAGE_COPY.titleZh,
      websiteUrl: defaultDeveloperProfile.websiteUrl,
      githubUrl: defaultDeveloperProfile.githubUrl,
      notes: lang === "zh" ? "这里只展示 public 类仓库。" : "Only public repositories are listed here.",
    },
    repositoryGroups: [
      {
        key: "project",
        title: lang === "zh" ? "仓库 · Project" : "Repositories · Project",
        description: lang === "zh" ? "公开 project 类仓库，按 5 条分页浏览。" : "Public project repositories, paged 5 at a time.",
        items: DEVELOPER_REPOSITORY_GROUPS.project,
      },
      {
        key: "skills",
        title: lang === "zh" ? "仓库 · Skills" : "Repositories · Skills",
        description: lang === "zh" ? "公开 skills 类仓库，按 5 条分页浏览。" : "Public skills repositories, paged 5 at a time.",
        items: DEVELOPER_REPOSITORY_GROUPS.skills,
      },
    ],
    manifesto: {
      title: lang === "zh" ? "开发者想说" : "A Note From The Developer",
      paragraphs:
        lang === "zh"
          ? DEVELOPER_MANIFESTO_ZH
          : [
              "Technology should serve people. I believe AI should become a shared public good that releases human life from repetitive competition and gives people more space to search for meaning.",
              "AI can expand freedom of thought by taking over repetitive mental and physical labor, leaving more time for creation, aesthetics, and self-exploration.",
              "AI can reduce inequality by lowering the cost of access to education, medicine, knowledge, and quality services regardless of region, wealth, or family background.",
              "AI can support fairness by relying on consistent rules and data rather than favoritism, bias, or closed interests in public allocation and opportunity selection.",
              "AI can strengthen rule of law through smarter governance, lower rights-protection costs, and more efficient legal and public-service workflows.",
              "When AI stops being a competitive weapon and becomes a shared benefit, people can return to life itself and move closer to a society built on connection and the common good.",
            ],
    },
    editorContent: {
      developerProfile: defaultDeveloperProfile,
      homePage: defaultHomeEditableContent,
      resourcesPage: defaultResourcesEditableContent,
      docsPage: defaultDocsEditableContent,
      resourceItems: defaultResourceItems,
      docItems: defaultDocItems,
    },
  };
}
