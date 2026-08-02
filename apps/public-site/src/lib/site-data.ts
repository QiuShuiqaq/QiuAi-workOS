export const workosConsoleUrl =
  process.env.NEXT_PUBLIC_WORKOS_CONSOLE_URL || "https://workos.qiuaihub.com";
export const adminConsoleUrl =
  process.env.NEXT_PUBLIC_ADMIN_CONSOLE_URL ||
  "https://admin-workos.qiuaihub.com";

export const productMetrics = [
  {
    label: "核心形态",
    value: "数字员工 / 数字工厂",
    note: "对话式任务与批量生产流程分开承载",
  },
  {
    label: "运行环境",
    value: "Windows 桌面端",
    note: "本地文件、Office 文档和企业资料在用户设备侧处理",
  },
  {
    label: "企业能力",
    value: "知识库 + 权益",
    note: "企业资料、套餐容量和设备绑定由服务端统一管理",
  },
  {
    label: "模型策略",
    value: "用户自配置",
    note: "支持主流供应商和自定义兼容接口，避免锁死模型",
  },
];

export const productPillars = [
  {
    title: "数字员工",
    summary:
      "面向文档、表格、会议、销售、运营等高频办公任务，安装后即可在桌面端发起任务并获得产物。",
    points: [
      "免费基础员工",
      "企业专属员工",
      "Office 产物交付",
      "过程日志可追踪",
    ],
  },
  {
    title: "数字工厂",
    summary:
      "面向批量化、参数化、可审查的生产流程，例如跨境商品图生成和视频质检剪辑。",
    points: ["批量上传", "参数面板", "任务队列", "输出队列与人工复核"],
  },
  {
    title: "企业知识库",
    summary:
      "企业端维护标准知识文档，设备端可同步企业知识库，并与本地知识库合并用于任务执行。",
    points: ["企业 PDF 知识资产", "设备同步", "版本启用", "本地资料补充"],
  },
  {
    title: "模型与工具配置",
    summary:
      "模型供应商、模型槽位、本地工具和知识库状态集中配置，员工和工厂按能力槽位调用。",
    points: ["文本模型", "图片模型", "语音模型", "自定义供应商"],
  },
];

export const factoryExamples = [
  {
    name: "跨境商品图工厂",
    audience: "跨境电商运营、视觉团队",
    output: "商品主图、白底图、尺寸图、场景图、换背景、换模特等图片产物",
  },
  {
    name: "视频质检剪辑工厂",
    audience: "内容审核、医疗案例视频、营销素材团队",
    output: "合格视频清单、筛选评分表、人工复核队列、可选初剪合集",
  },
];

export const launchChecklist = [
  "下载 Windows 客户端并安装",
  "注册账号并绑定企业设备",
  "在购买中心选择套餐",
  "配置模型供应商和企业知识库",
  "安装需要的数字员工或数字工厂",
  "从桌面端发起任务并查看产物与日志",
];
