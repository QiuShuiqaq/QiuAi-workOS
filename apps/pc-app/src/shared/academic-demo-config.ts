export const academicDemoSectionTypes = [
  'cover',
  'research_background',
  'method_model',
  'formula_reference',
  'dataset_overview',
  'data_analysis',
  'experiment_comparison',
  'interactive_visualization',
  'conclusion_value'
] as const;

export type AcademicDemoSectionType = typeof academicDemoSectionTypes[number];

export type AcademicDemoConfidence = 'high' | 'medium' | 'low';

export interface AcademicDemoSourceRef {
  sourceId: string;
  fileName: string;
  fileType: 'docx' | 'pdf' | 'xlsx' | 'csv';
  page?: number;
  sheetName?: string;
  rowRange?: string;
  columnNames?: string[];
  excerpt?: string;
}

export interface AcademicDemoEvidence {
  sourceRefs: AcademicDemoSourceRef[];
  confidence: AcademicDemoConfidence;
  extractionMethod: 'local_parser' | 'llm_structured_extraction' | 'vision' | 'manual';
}

export interface AcademicDemoSource {
  id: string;
  fileName: string;
  fileType: 'docx' | 'pdf' | 'xlsx' | 'csv';
  localPath: string;
  text?: string;
  truncated?: boolean;
  sizeBytes?: number;
}

export interface AcademicColumnProfile {
  name: string;
  inferredType: 'number' | 'category' | 'datetime' | 'text' | 'boolean' | 'unknown';
  missingCount: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stddev?: number;
  topValues?: Array<{ value: string; count: number }>;
}

export interface AcademicTableProfile {
  dataSourceId: string;
  fileName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  columns: AcademicColumnProfile[];
  warnings: string[];
}

export type AcademicChartType =
  | 'metric_cards'
  | 'bar'
  | 'line'
  | 'scatter'
  | 'box'
  | 'histogram'
  | 'heatmap'
  | 'comparison_table';

export interface AcademicChartSpec {
  id: string;
  type: AcademicChartType;
  title: string;
  dataSourceId: string;
  x?: string;
  y?: string;
  series?: string;
  metrics?: string[];
  rows?: Array<Record<string, string | number | boolean | null>>;
  evidence: AcademicDemoEvidence;
}

export interface AcademicFormulaBlock {
  id: string;
  latex: string;
  title?: string;
  explanation?: string;
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>;
  evidence: AcademicDemoEvidence;
}

export type AcademicDemoBlock =
  | { type: 'text'; id: string; title?: string; body: string; evidence?: AcademicDemoEvidence }
  | { type: 'metric'; id: string; label: string; value: string | number; unit?: string; evidence?: AcademicDemoEvidence }
  | { type: 'formula'; id: string; formulaId: string }
  | { type: 'chart'; id: string; chartId: string }
  | { type: 'table'; id: string; title: string; rows: Array<Record<string, unknown>>; evidence?: AcademicDemoEvidence }
  | { type: 'process'; id: string; steps: Array<{ title: string; description?: string }>; evidence?: AcademicDemoEvidence }
  | { type: 'interactive'; id: string; simulationId: string };

export interface AcademicDemoSection {
  id: string;
  type: AcademicDemoSectionType;
  title: string;
  enabled: boolean;
  order: number;
  depth: 'short' | 'standard' | 'deep';
  blocks: AcademicDemoBlock[];
  evidence?: AcademicDemoEvidence;
}

export interface AcademicDemoUnresolvedItem {
  id: string;
  targetSectionType: AcademicDemoSectionType;
  reason: 'low_confidence' | 'missing_source' | 'ambiguous_section' | 'unsupported_format' | 'needs_manual_input';
  suggestion: string;
  candidateText?: string;
  sourceRefs?: AcademicDemoSourceRef[];
}

export interface AcademicDemoConfig {
  schemaVersion: '1.0.0';
  demoId: string;
  generatedAt: string;
  factoryTemplateId: 'factory_academic_project_demo_v1';
  roleCode: 'ai-factory-academic-project-demo-v1';
  project: {
    name: string;
    researchDirection?: string;
    keywords: string[];
    organization?: string;
    team?: string;
    coreConclusion?: string;
  };
  presentation: {
    visualStyle: string;
    language: 'zh-CN' | 'en-US';
    enableLoadingAnimation: boolean;
    enableInteractiveSimulation: boolean;
    autoPlay: boolean;
    durationMinutes: number;
  };
  sources: AcademicDemoSource[];
  sections: AcademicDemoSection[];
  charts: AcademicChartSpec[];
  formulas: AcademicFormulaBlock[];
  dataProfiles: AcademicTableProfile[];
  assets: Array<{ id: string; type: string; localPath?: string; title?: string }>;
  unresolvedItems: AcademicDemoUnresolvedItem[];
}

export interface AcademicDemoParameters {
  projectName?: string;
  projectType?: string;
  audience?: string;
  demoDurationMinutes?: number;
  visualStyle?: string;
  enableLoadingAnimation?: boolean;
  enableInteractiveSimulation?: boolean;
  enabledSections?: string[];
  sectionOrder?: string[];
  sectionDepth?: Record<string, 'short' | 'standard' | 'deep'>;
  maxFormulaCount?: number;
  maxChartCount?: number;
  maxExperimentComparisonCount?: number;
  language?: 'zh-CN' | 'en-US';
}

const sectionTitleByType: Record<AcademicDemoSectionType, string> = {
  cover: '项目首页',
  research_background: '研究背景',
  method_model: '方法模型',
  formula_reference: '公式引用',
  dataset_overview: '数据集说明',
  data_analysis: '数据分析',
  experiment_comparison: '实验对比',
  interactive_visualization: '可视化演示',
  conclusion_value: '结论与价值'
};

export function normalizeAcademicDemoParameters(value: unknown): AcademicDemoParameters {
  const record = isRecord(value) ? value : {};
  return {
    projectName: readString(record.projectName),
    projectType: readString(record.projectType) ?? 'academic_research',
    audience: readString(record.audience) ?? 'judges',
    demoDurationMinutes: clampInteger(record.demoDurationMinutes, 5, 3, 15),
    visualStyle: readString(record.visualStyle) ?? 'academic_clean',
    enableLoadingAnimation: readBoolean(record.enableLoadingAnimation, true),
    enableInteractiveSimulation: readBoolean(record.enableInteractiveSimulation, true),
    enabledSections: readSectionList(record.enabledSections, academicDemoSectionTypes),
    sectionOrder: readSectionList(record.sectionOrder, academicDemoSectionTypes),
    sectionDepth: readSectionDepth(record.sectionDepth),
    maxFormulaCount: clampInteger(record.maxFormulaCount, 8, 0, 20),
    maxChartCount: clampInteger(record.maxChartCount, 8, 0, 20),
    maxExperimentComparisonCount: clampInteger(record.maxExperimentComparisonCount, 6, 0, 20),
    language: record.language === 'en-US' ? 'en-US' : 'zh-CN'
  };
}

export function buildAcademicDemoConfig(input: {
  demoId: string;
  generatedAt: string;
  taskTitle: string;
  parameters: AcademicDemoParameters;
  extraction: unknown;
  sources: AcademicDemoSource[];
  dataProfiles: AcademicTableProfile[];
  charts: AcademicChartSpec[];
}): AcademicDemoConfig {
  const extraction = isRecord(input.extraction) ? input.extraction : {};
  const projectRecord = isRecord(extraction.project) ? extraction.project : {};
  const projectName =
    input.parameters.projectName?.trim() ||
    readString(projectRecord.name) ||
    inferProjectNameFromSources(input.sources) ||
    input.taskTitle ||
    '未命名学术项目';
  const maxFormulaCount = input.parameters.maxFormulaCount ?? 8;
  const formulas = readFormulaBlocks(extraction.formulas, input.sources).slice(0, maxFormulaCount);
  const unresolvedItems = [
    ...readUnresolvedItems(extraction.unresolvedItems),
    ...buildSourceWarnings(input.sources)
  ];
  const sections = buildSections({
    extractionSections: extraction.sections,
    parameters: input.parameters,
    sources: input.sources,
    charts: input.charts,
    formulas,
    dataProfiles: input.dataProfiles,
    projectName
  });

  return {
    schemaVersion: '1.0.0',
    demoId: input.demoId,
    generatedAt: input.generatedAt,
    factoryTemplateId: 'factory_academic_project_demo_v1',
    roleCode: 'ai-factory-academic-project-demo-v1',
    project: {
      name: projectName,
      researchDirection: readString(projectRecord.researchDirection),
      keywords: readStringList(projectRecord.keywords).slice(0, 12),
      organization: readString(projectRecord.organization),
      team: readString(projectRecord.team),
      coreConclusion: readString(projectRecord.coreConclusion)
    },
    presentation: {
      visualStyle: input.parameters.visualStyle ?? 'academic_clean',
      language: input.parameters.language ?? 'zh-CN',
      enableLoadingAnimation: input.parameters.enableLoadingAnimation ?? true,
      enableInteractiveSimulation: input.parameters.enableInteractiveSimulation ?? true,
      autoPlay: false,
      durationMinutes: input.parameters.demoDurationMinutes ?? 5
    },
    sources: input.sources,
    sections,
    charts: input.charts.slice(0, input.parameters.maxChartCount ?? 8),
    formulas,
    dataProfiles: input.dataProfiles,
    assets: [],
    unresolvedItems
  };
}

export function renderAcademicDemoReport(config: AcademicDemoConfig): string {
  const sourceRows = config.sources.map((source) =>
    `| ${source.fileName} | ${source.fileType} | ${source.text ? '已提取' : '未提取'} | ${source.truncated ? '是' : '否'} |`
  );
  return [
    `# ${config.project.name} - 识别报告`,
    '',
    `生成时间：${config.generatedAt}`,
    '',
    '## 资料',
    '',
    '| 文件 | 类型 | 状态 | 是否截断 |',
    '| --- | --- | --- | --- |',
    ...sourceRows,
    '',
    '## 板块',
    '',
    ...config.sections.map((section) => `- ${section.order}. ${section.title}：${section.blocks.length} 个内容块`),
    '',
    '## 图表和公式',
    '',
    `- 图表：${config.charts.length} 个`,
    `- 公式：${config.formulas.length} 条`,
    `- 待补充：${config.unresolvedItems.length} 项`
  ].join('\n');
}

export function renderAcademicDemoUnresolvedMarkdown(config: AcademicDemoConfig): string {
  if (config.unresolvedItems.length === 0) {
    return `# ${config.project.name} - 待补充内容\n\n暂无待补充内容。\n`;
  }

  return [
    `# ${config.project.name} - 待补充内容`,
    '',
    ...config.unresolvedItems.flatMap((item, index) => [
      `## ${index + 1}. ${sectionTitleByType[item.targetSectionType]}`,
      '',
      `原因：${item.reason}`,
      '',
      `建议：${item.suggestion}`,
      item.candidateText ? `\n候选内容：${item.candidateText}` : ''
    ])
  ].join('\n');
}

export function renderAcademicDemoHtml(config: AcademicDemoConfig): string {
  const serializedConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${config.presentation.language === 'en-US' ? 'en' : 'zh-CN'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(config.project.name)}</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", Arial, sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #172033; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 240px 1fr 280px; }
    nav, aside { background: #ffffff; border-right: 1px solid #e6e8ee; padding: 20px; }
    aside { border-right: 0; border-left: 1px solid #e6e8ee; }
    main { padding: 32px 42px; overflow: auto; }
    h1 { margin: 0 0 12px; font-size: 34px; letter-spacing: 0; }
    h2 { margin: 0 0 18px; font-size: 26px; letter-spacing: 0; }
    button { width: 100%; margin: 0 0 8px; padding: 10px 12px; border: 1px solid #d8dce6; background: #fff; border-radius: 6px; text-align: left; cursor: pointer; }
    button.active { border-color: #1677ff; color: #1677ff; background: #eef5ff; }
    .block { background: #fff; border: 1px solid #e6e8ee; border-radius: 8px; padding: 18px; margin: 0 0 14px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .metric { background: #f8fafc; border: 1px solid #e6e8ee; border-radius: 8px; padding: 14px; }
    .metric strong { display: block; font-size: 24px; margin-top: 6px; }
    pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #e6e8ee; border-radius: 8px; padding: 14px; }
    .footer { position: fixed; left: 240px; right: 280px; bottom: 0; display: flex; gap: 10px; padding: 12px 42px; background: rgba(246,247,249,.92); border-top: 1px solid #e6e8ee; }
    .footer button { width: auto; min-width: 96px; text-align: center; margin: 0; }
  </style>
</head>
<body>
  <div class="shell">
    <nav><h3>演示导航</h3><div id="nav"></div></nav>
    <main><section id="slide"></section></main>
    <aside><h3>资料与备注</h3><div id="side"></div></aside>
  </div>
  <div class="footer"><button id="prev">上一页</button><button id="next">下一页</button><button id="full">全屏</button><span id="progress"></span></div>
  <script type="application/json" id="demo-config">${serializedConfig}</script>
  <script>
    const config = JSON.parse(document.getElementById('demo-config').textContent);
    const sections = config.sections.filter(item => item.enabled !== false);
    let index = 0;
    const nav = document.getElementById('nav');
    const slide = document.getElementById('slide');
    const side = document.getElementById('side');
    const progress = document.getElementById('progress');
    function render() {
      nav.innerHTML = sections.map((s, i) => '<button class="' + (i === index ? 'active' : '') + '" data-i="' + i + '">' + (i + 1) + '. ' + escapeText(s.title) + '</button>').join('');
      const section = sections[index];
      slide.innerHTML = '<h1>' + escapeText(config.project.name) + '</h1><h2>' + escapeText(section.title) + '</h2>' + section.blocks.map(renderBlock).join('');
      side.innerHTML = '<p>资料：' + config.sources.length + ' 个</p><p>图表：' + config.charts.length + ' 个</p><p>公式：' + config.formulas.length + ' 条</p><p>待补充：' + config.unresolvedItems.length + ' 项</p>';
      progress.textContent = (index + 1) + ' / ' + sections.length;
      nav.querySelectorAll('button').forEach(btn => btn.onclick = () => { index = Number(btn.dataset.i); render(); });
    }
    function renderBlock(block) {
      if (block.type === 'metric') return '<div class="metric"><span>' + escapeText(block.label) + '</span><strong>' + escapeText(String(block.value)) + '</strong></div>';
      if (block.type === 'formula') {
        const formula = config.formulas.find(item => item.id === block.formulaId);
        return '<div class="block"><pre>' + escapeText(formula ? formula.latex : block.formulaId) + '</pre><p>' + escapeText(formula?.explanation || '') + '</p></div>';
      }
      if (block.type === 'chart') {
        const chart = config.charts.find(item => item.id === block.chartId);
        return '<div class="block"><strong>' + escapeText(chart?.title || '图表') + '</strong><pre>' + escapeText(JSON.stringify(chart?.rows || chart?.metrics || [], null, 2)) + '</pre></div>';
      }
      if (block.type === 'table') return '<div class="block"><strong>' + escapeText(block.title) + '</strong><pre>' + escapeText(JSON.stringify(block.rows, null, 2)) + '</pre></div>';
      if (block.type === 'interactive') return '<div class="block"><strong>交互演示</strong><p>拖动参数后展示模拟结果。第一版为可控模拟，不执行真实算法。</p><input type="range" min="0" max="100" value="50" /></div>';
      return '<div class="block"><strong>' + escapeText(block.title || '') + '</strong><p>' + escapeText(block.body || '') + '</p></div>';
    }
    function escapeText(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
    document.getElementById('prev').onclick = () => { index = Math.max(0, index - 1); render(); };
    document.getElementById('next').onclick = () => { index = Math.min(sections.length - 1, index + 1); render(); };
    document.getElementById('full').onclick = () => document.documentElement.requestFullscreen?.();
    window.onkeydown = (event) => { if (event.key === 'ArrowLeft') document.getElementById('prev').click(); if (event.key === 'ArrowRight') document.getElementById('next').click(); };
    render();
  </script>
</body>
</html>`;
}

function buildSections(input: {
  extractionSections: unknown;
  parameters: AcademicDemoParameters;
  sources: AcademicDemoSource[];
  charts: AcademicChartSpec[];
  formulas: AcademicFormulaBlock[];
  dataProfiles: AcademicTableProfile[];
  projectName: string;
}): AcademicDemoSection[] {
  const enabled = new Set(readSectionList(input.parameters.enabledSections, academicDemoSectionTypes));
  const order = readSectionList(input.parameters.sectionOrder, academicDemoSectionTypes);
  const extractionSections = Array.isArray(input.extractionSections) ? input.extractionSections : [];
  const extractionByType = new Map<AcademicDemoSectionType, unknown>();
  for (const section of extractionSections) {
    const record = isRecord(section) ? section : {};
    const type = readSectionType(record.type);
    if (type && !extractionByType.has(type)) {
      extractionByType.set(type, record);
    }
  }

  return order.map((type, index) => {
    const record = isRecord(extractionByType.get(type)) ? extractionByType.get(type) as Record<string, unknown> : {};
    const blocks = readSectionBlocks(record.blocks, input.sources, type);
    if (type === 'cover' && blocks.length === 0) {
      blocks.push({ type: 'text', id: 'cover-title', title: '项目名称', body: input.projectName });
    }
    if (type === 'formula_reference') {
      blocks.push(...input.formulas.map((formula) => ({ type: 'formula' as const, id: `formula-block-${formula.id}`, formulaId: formula.id })));
    }
    if (type === 'data_analysis') {
      blocks.push(...input.charts.map((chart) => ({ type: 'chart' as const, id: `chart-block-${chart.id}`, chartId: chart.id })));
    }
    if (type === 'dataset_overview') {
      blocks.push(...input.dataProfiles.slice(0, 4).map((profile, profileIndex) => ({
        type: 'metric' as const,
        id: `table-profile-${profileIndex + 1}`,
        label: profile.fileName,
        value: `${profile.rowCount} 行 / ${profile.columnCount} 列`
      })));
    }
    if (type === 'interactive_visualization' && input.parameters.enableInteractiveSimulation !== false) {
      blocks.push({ type: 'interactive', id: 'interactive-demo', simulationId: 'default-simulation' });
    }

    return {
      id: `section-${type}`,
      type,
      title: readString(record.title) ?? sectionTitleByType[type],
      enabled: enabled.has(type),
      order: index + 1,
      depth: input.parameters.sectionDepth?.[type] ?? 'standard',
      blocks
    };
  });
}

function readSectionBlocks(value: unknown, sources: AcademicDemoSource[], sectionType: AcademicDemoSectionType): AcademicDemoBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index): AcademicDemoBlock[] => {
    const record = isRecord(item) ? item : {};
    const body = readString(record.body ?? record.text ?? record.content);
    if (!body) {
      return [];
    }
    const confidence = readConfidence(record.confidence);
    if (confidence === 'low') {
      return [];
    }
    return [{
      type: 'text',
      id: `${sectionType}-text-${index + 1}`,
      title: readString(record.title),
      body,
      evidence: buildEvidence(record, sources, confidence)
    }];
  });
}

function readFormulaBlocks(value: unknown, sources: AcademicDemoSource[]): AcademicFormulaBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index): AcademicFormulaBlock[] => {
    const record = isRecord(item) ? item : {};
    const latex = readString(record.latex ?? record.formula);
    if (!latex) {
      return [];
    }
    return [{
      id: `formula-${index + 1}`,
      latex,
      title: readString(record.title),
      explanation: readString(record.explanation),
      variables: readFormulaVariables(record.variables),
      evidence: buildEvidence(record, sources, readConfidence(record.confidence))
    }];
  });
}

function readUnresolvedItems(value: unknown): AcademicDemoUnresolvedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index): AcademicDemoUnresolvedItem[] => {
    const record = isRecord(item) ? item : {};
    const targetSectionType = readSectionType(record.targetSectionType) ?? 'cover';
    return [{
      id: `unresolved-${index + 1}`,
      targetSectionType,
      reason: readUnresolvedReason(record.reason),
      suggestion: readString(record.suggestion) ?? '请人工补充或确认这一部分内容。',
      candidateText: readString(record.candidateText)
    }];
  });
}

function buildSourceWarnings(sources: AcademicDemoSource[]): AcademicDemoUnresolvedItem[] {
  return sources.flatMap((source, index): AcademicDemoUnresolvedItem[] =>
    source.text ? [] : [{
      id: `source-warning-${index + 1}`,
      targetSectionType: 'cover',
      reason: 'unsupported_format',
      suggestion: `文件 ${source.fileName} 未能提取到文本，请人工确认是否需要补充。`
    }]
  );
}

function buildEvidence(
  record: Record<string, unknown>,
  sources: AcademicDemoSource[],
  confidence: AcademicDemoConfidence
): AcademicDemoEvidence {
  const sourceFileName = readString(record.sourceFileName ?? record.fileName);
  const matchedSource = sourceFileName
    ? sources.find((source) => source.fileName === sourceFileName)
    : sources[0];
  return {
    sourceRefs: matchedSource
      ? [{
          sourceId: matchedSource.id,
          fileName: matchedSource.fileName,
          fileType: matchedSource.fileType,
          excerpt: readString(record.excerpt)
        }]
      : [],
    confidence,
    extractionMethod: 'llm_structured_extraction'
  };
}

function readFormulaVariables(value: unknown): AcademicFormulaBlock['variables'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((item): NonNullable<AcademicFormulaBlock['variables']> => {
    const record = isRecord(item) ? item : {};
    const symbol = readString(record.symbol);
    const meaning = readString(record.meaning);
    return symbol && meaning ? [{ symbol, meaning, unit: readString(record.unit) }] : [];
  });
}

function readSectionDepth(value: unknown): Record<string, 'short' | 'standard' | 'deep'> {
  if (!isRecord(value)) {
    return Object.fromEntries(academicDemoSectionTypes.map((type) => [type, 'standard']));
  }
  return Object.fromEntries(
    academicDemoSectionTypes.map((type) => {
      const item = value[type];
      return [type, item === 'short' || item === 'deep' ? item : 'standard'];
    })
  );
}

function readSectionList(value: unknown, fallback: readonly AcademicDemoSectionType[]): AcademicDemoSectionType[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const values = value.flatMap((item) => {
    const type = readSectionType(item);
    return type ? [type] : [];
  });
  return values.length ? [...new Set(values)] : [...fallback];
}

function readSectionType(value: unknown): AcademicDemoSectionType | undefined {
  return typeof value === 'string' && (academicDemoSectionTypes as readonly string[]).includes(value)
    ? value as AcademicDemoSectionType
    : undefined;
}

function readConfidence(value: unknown): AcademicDemoConfidence {
  return value === 'high' || value === 'low' ? value : 'medium';
}

function readUnresolvedReason(value: unknown): AcademicDemoUnresolvedItem['reason'] {
  const reasons: AcademicDemoUnresolvedItem['reason'][] = [
    'low_confidence',
    'missing_source',
    'ambiguous_section',
    'unsupported_format',
    'needs_manual_input'
  ];
  return typeof value === 'string' && reasons.includes(value as AcademicDemoUnresolvedItem['reason'])
    ? value as AcademicDemoUnresolvedItem['reason']
    : 'needs_manual_input';
}

function inferProjectNameFromSources(sources: AcademicDemoSource[]): string | undefined {
  const source = sources.find((item) => item.fileName.trim());
  return source?.fileName.replace(/\.[^.]+$/, '').slice(0, 60);
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = readString(item);
      return text ? [text] : [];
    });
  }
  const text = readString(value);
  return text ? text.split(/[，,;；\n]/).map((item) => item.trim()).filter(Boolean) : [];
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char] ?? char);
}
