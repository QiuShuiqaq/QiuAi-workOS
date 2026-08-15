export interface SoftwareCopilotProductSeed {
  code: string;
  name: string;
  softwareName: string;
  category: string;
  description: string;
  platforms: string[];
  capabilities: string[];
  personalMonthlyPriceCents: number;
  personalAnnualPriceCents: number;
  enterpriseMonthlyUnitPriceCents: number;
  enterpriseAnnualUnitPriceCents: number;
  currency: string;
  sortOrder: number;
}

const monthlyPriceCents = 990;
const annualPriceCents = 9900;

export const softwareCopilotProductSeeds: SoftwareCopilotProductSeed[] = [
  {
    code: 'photoshop-copilot',
    name: 'Photoshop 副驾',
    softwareName: 'Photoshop',
    category: '设计修图',
    description: '面向图片处理、商品图优化、图层整理和设计文案辅助的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['图片理解', '修图建议', '图层脚本', '批量命名'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 100
  },
  {
    code: 'coreldraw-copilot',
    name: 'CorelDRAW 副驾',
    softwareName: 'CorelDRAW',
    category: '矢量排版',
    description: '面向标牌、包装、文字排版和简单矢量绘制的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['矢量绘制', '文字排版', '版面调整', '文件导出'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 110
  },
  {
    code: 'excel-copilot',
    name: 'Excel 副驾',
    softwareName: 'Excel',
    category: '办公数据',
    description: '面向表格清洗、公式生成、数据对比和报表整理的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['公式生成', '数据清洗', '表格分析', '报表整理'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 120
  },
  {
    code: 'ppt-copilot',
    name: 'PPT 副驾',
    softwareName: 'PowerPoint',
    category: '演示汇报',
    description: '面向演示结构、页面文案、图表说明和版式调整的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['大纲生成', '页面文案', '版式建议', '图表说明'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 130
  },
  {
    code: 'cad-copilot',
    name: 'CAD 副驾',
    softwareName: 'CAD',
    category: '工程绘图',
    description: '面向基础绘图、尺寸标注、图层规范和工程说明的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['绘图指令', '尺寸标注', '图层规范', '工程说明'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 140
  },
  {
    code: 'jianying-copilot',
    name: '剪映副驾',
    softwareName: '剪映',
    category: '视频剪辑',
    description: '面向短视频脚本、剪辑节奏、字幕整理和成片检查的 AI 编辑副驾。',
    platforms: ['windows'],
    capabilities: ['脚本拆解', '字幕整理', '剪辑建议', '成片检查'],
    personalMonthlyPriceCents: monthlyPriceCents,
    personalAnnualPriceCents: annualPriceCents,
    enterpriseMonthlyUnitPriceCents: monthlyPriceCents,
    enterpriseAnnualUnitPriceCents: annualPriceCents,
    currency: 'CNY',
    sortOrder: 150
  }
];
