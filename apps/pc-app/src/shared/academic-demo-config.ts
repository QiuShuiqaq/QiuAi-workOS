export const academicDemoSectionTypes = [
  'cover',
  'research_background',
  'method_model',
  'data_analysis',
  'conclusion_value'
] as const;

export type AcademicDemoSectionType = typeof academicDemoSectionTypes[number];

export const academicDemoSectionTitles: Record<AcademicDemoSectionType, string> = {
  cover: '项目首页',
  research_background: '研究背景',
  method_model: '方法模型',
  data_analysis: '数据与验证',
  conclusion_value: '结论与价值'
};

const legacyAcademicDemoSectionTypeMap: Record<string, AcademicDemoSectionType> = {
  formula_reference: 'method_model',
  dataset_overview: 'data_analysis',
  experiment_comparison: 'data_analysis',
  interactive_visualization: 'data_analysis'
};

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
  previewRows?: Array<Record<string, string>>;
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

export interface AcademicFormulaDraft {
  title?: string;
  latex: string;
  explanation?: string;
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>;
}

export type AcademicDataComparisonChartType = 'auto' | 'bar' | 'line' | 'table';

export interface AcademicDataComparisonSettings {
  enabled?: boolean;
  title?: string;
  xColumn?: string;
  yColumn?: string;
  chartType?: AcademicDataComparisonChartType;
  showTable?: boolean;
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
  researchDirection?: string;
  keywords?: string[];
  organization?: string;
  team?: string;
  coreConclusion?: string;
  projectType?: string;
  audience?: string;
  demoDurationMinutes?: number;
  visualStyle?: string;
  enableLoadingAnimation?: boolean;
  enableInteractiveSimulation?: boolean;
  enabledSections?: string[];
  sectionOrder?: string[];
  sectionDepth?: Record<string, 'short' | 'standard' | 'deep'>;
  sectionEntries?: AcademicDemoSectionEntry[];
  pageEntries?: AcademicDemoSectionEntry[];
  maxFormulaCount?: number;
  maxChartCount?: number;
  maxExperimentComparisonCount?: number;
  language?: 'zh-CN' | 'en-US';
}

export interface AcademicDemoSectionEntry {
  type: AcademicDemoSectionType;
  enabled?: boolean;
  order?: number;
  title?: string;
  depth?: 'short' | 'standard' | 'deep';
  manualContent?: string;
  contentFields?: Record<string, string>;
  formulaDrafts?: AcademicFormulaDraft[];
  dataComparison?: AcademicDataComparisonSettings;
}

export type AcademicDemoPageEntry = AcademicDemoSectionEntry;

export function normalizeAcademicDemoParameters(value: unknown): AcademicDemoParameters {
  const record = isRecord(value) ? value : {};
  return {
    projectName: readString(record.projectName),
    researchDirection: readString(record.researchDirection),
    keywords: readStringList(record.keywords).slice(0, 12),
    organization: readString(record.organization),
    team: readString(record.team),
    coreConclusion: readString(record.coreConclusion),
    projectType: readString(record.projectType) ?? 'academic_research',
    audience: readString(record.audience) ?? 'judges',
    demoDurationMinutes: clampInteger(record.demoDurationMinutes, 5, 3, 15),
    visualStyle: readString(record.visualStyle) ?? 'academic_clean',
    enableLoadingAnimation: readBoolean(record.enableLoadingAnimation, true),
    enableInteractiveSimulation: readBoolean(record.enableInteractiveSimulation, true),
    enabledSections: readSectionList(record.enabledSections, academicDemoSectionTypes),
    sectionOrder: readSectionList(record.sectionOrder, academicDemoSectionTypes),
    sectionDepth: readSectionDepth(record.sectionDepth),
    sectionEntries: readSectionEntries(record.sectionEntries ?? record.pageEntries),
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
  const sectionEntries = readSectionEntries(input.parameters.sectionEntries);
  const methodEntry = sectionEntries.find((entry) => entry.type === 'method_model');
  const dataEntry = sectionEntries.find((entry) => entry.type === 'data_analysis');
  const manualFormulas = readManualFormulaBlocks(methodEntry?.formulaDrafts);
  const extractedFormulas = readFormulaBlocks(extraction.formulas, input.sources);
  const formulas = mergeFormulaBlocks(manualFormulas, extractedFormulas).slice(0, maxFormulaCount);
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
    projectName,
    sectionEntries
  });

  return {
    schemaVersion: '1.0.0',
    demoId: input.demoId,
    generatedAt: input.generatedAt,
    factoryTemplateId: 'factory_academic_project_demo_v1',
    roleCode: 'ai-factory-academic-project-demo-v1',
    project: {
      name: projectName,
      researchDirection: input.parameters.researchDirection ?? readString(projectRecord.researchDirection),
      keywords: input.parameters.keywords?.length ? input.parameters.keywords : readStringList(projectRecord.keywords).slice(0, 12),
      organization: input.parameters.organization ?? readString(projectRecord.organization),
      team: input.parameters.team ?? readString(projectRecord.team),
      coreConclusion: input.parameters.coreConclusion ?? readString(projectRecord.coreConclusion)
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
    charts: applyDataComparisonSettings(
      input.charts.slice(0, input.parameters.maxChartCount ?? 8),
      dataEntry?.dataComparison,
      input.dataProfiles
    ),
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
      `## ${index + 1}. ${academicDemoSectionTitles[item.targetSectionType]}`,
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
    .shell { min-height: 100vh; display: grid; grid-template-columns: 240px minmax(0, 1fr) 280px; }
    nav, aside { background: #ffffff; border-right: 1px solid #e6e8ee; padding: 20px; }
    aside { border-right: 0; border-left: 1px solid #e6e8ee; }
    main { padding: 32px 42px; overflow: auto; }
    h1 { margin: 0 0 12px; font-size: 34px; letter-spacing: 0; }
    h2 { margin: 0 0 18px; font-size: 26px; letter-spacing: 0; }
    button { width: 100%; margin: 0 0 8px; padding: 10px 12px; border: 1px solid #d8dce6; background: #fff; border-radius: 6px; text-align: left; cursor: pointer; }
    button.active { border-color: #1677ff; color: #1677ff; background: #eef5ff; }
    .block { background: #fff; border: 1px solid #e6e8ee; border-radius: 8px; padding: 18px; margin: 0 0 14px; overflow: auto; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .metric { background: #f8fafc; border: 1px solid #e6e8ee; border-radius: 8px; padding: 14px; }
    .metric strong { display: block; font-size: 24px; margin-top: 6px; }
    .formula-card { border-left: 4px solid #1677ff; }
    .formula-display { margin: 12px 0; padding: 18px; background: #f8fafc; border: 1px solid #dce3ee; border-radius: 8px; overflow-x: auto; }
    .formula-display code { font-family: "Consolas", "Courier New", monospace; font-size: 18px; white-space: pre-wrap; word-break: break-word; }
    .formula-variable-table, .data-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .formula-variable-table th, .formula-variable-table td, .data-table th, .data-table td { border: 1px solid #e3e7ef; padding: 8px 10px; text-align: left; font-size: 13px; }
    .formula-variable-table th, .data-table th { background: #f8fafc; font-weight: 600; }
    .data-table-wrap { overflow-x: auto; }
    .chart-box { min-height: 260px; }
    .chart-box svg { display: block; width: 100%; height: 260px; }
    .chart-axis { stroke: #b9c3d4; stroke-width: 1; }
    .chart-bar { fill: #1677ff; opacity: .82; }
    .chart-line { fill: none; stroke: #1677ff; stroke-width: 3; }
    .chart-point { fill: #1677ff; }
    .chart-label { fill: #566273; font-size: 11px; }
    .note { color: #667085; font-size: 13px; }
    pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #e6e8ee; border-radius: 8px; padding: 14px; }
    .footer { position: fixed; left: 240px; right: 280px; bottom: 0; display: flex; gap: 10px; padding: 12px 42px; background: rgba(246,247,249,.92); border-top: 1px solid #e6e8ee; }
    .footer button { width: auto; min-width: 96px; text-align: center; margin: 0; }
    @media (max-width: 980px) {
      .shell { grid-template-columns: 180px minmax(0, 1fr); }
      aside { display: none; }
      .footer { left: 180px; right: 0; }
      main { padding: 24px; }
    }
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
      side.innerHTML = '<p>资料：' + config.sources.length + ' 个</p><p>数据表：' + config.dataProfiles.length + ' 个</p><p>图表：' + config.charts.length + ' 个</p><p>公式：' + config.formulas.length + ' 条</p><p>待补充：' + config.unresolvedItems.length + ' 项</p>' +
        '<p class="note">页面内容只使用已提取或人工确认的资料。未识别内容不会自动补写。</p>';
      progress.textContent = (index + 1) + ' / ' + sections.length;
      nav.querySelectorAll('button').forEach(btn => btn.onclick = () => { index = Number(btn.dataset.i); render(); });
    }
    function renderBlock(block) {
      if (block.type === 'metric') return '<div class="metric"><span>' + escapeText(block.label) + '</span><strong>' + escapeText(String(block.value)) + '</strong></div>';
      if (block.type === 'formula') {
        const formula = config.formulas.find(item => item.id === block.formulaId);
        if (!formula) return '<div class="block formula-card"><p class="note">公式未找到：' + escapeText(block.formulaId) + '</p></div>';
        const variables = (formula.variables || []).map(item => '<tr><td>' + escapeText(item.symbol) + '</td><td>' + escapeText(item.meaning) + '</td><td>' + escapeText(item.unit || '') + '</td></tr>').join('');
        return '<div class="block formula-card"><strong>' + escapeText(formula.title || '公式') + '</strong><div class="formula-display"><code>' + escapeText(formula.latex) + '</code></div>' +
          (formula.explanation ? '<p>' + escapeText(formula.explanation) + '</p>' : '') +
          (variables ? '<table class="formula-variable-table"><thead><tr><th>变量</th><th>含义</th><th>单位</th></tr></thead><tbody>' + variables + '</tbody></table>' : '') +
          '</div>';
      }
      if (block.type === 'chart') {
        const chart = config.charts.find(item => item.id === block.chartId);
        return renderChart(chart);
      }
      if (block.type === 'table') return '<div class="block"><strong>' + escapeText(block.title) + '</strong>' + renderTable(block.rows) + '</div>';
      if (block.type === 'interactive') return '<div class="block"><strong>交互演示</strong><p class="note">拖动参数后展示模拟结果。第一版为可控模拟，不执行真实算法。</p><input type="range" min="0" max="100" value="50" /></div>';
      return '<div class="block"><strong>' + escapeText(block.title || '') + '</strong><p>' + escapeText(block.body || '') + '</p></div>';
    }
    function renderChart(chart) {
      if (!chart) return '<div class="block"><p class="note">图表未找到。</p></div>';
      const profile = config.dataProfiles.find(item => item.dataSourceId === chart.dataSourceId);
      const rows = profile && profile.previewRows ? profile.previewRows : [];
      if (chart.type === 'metric_cards') {
        const metrics = (chart.metrics || []).map(name => {
          const column = profile && profile.columns ? profile.columns.find(item => item.name === name) : null;
          return '<div class="metric"><span>' + escapeText(name) + '</span><strong>' + escapeText(formatMetric(column)) + '</strong></div>';
        }).join('');
        return '<div class="block"><strong>' + escapeText(chart.title) + '</strong><div class="metric-grid">' + (metrics || '<p class="note">没有可展示的数值指标。</p>') + '</div></div>';
      }
      if (chart.type === 'bar' || chart.type === 'line') {
        return '<div class="block"><strong>' + escapeText(chart.title) + '</strong>' + renderSvgChart(chart, rows) + '</div>';
      }
      return '<div class="block"><strong>' + escapeText(chart.title) + '</strong>' + renderTable(rows) + '</div>';
    }
    function renderSvgChart(chart, rows) {
      const xKey = chart.x;
      const yKey = chart.y;
      const points = rows.map(row => ({ label: String(row[xKey] || ''), value: Number(String(row[yKey] || '').replace(/[%￥¥,\\s]/g, '')) })).filter(item => Number.isFinite(item.value)).slice(0, 12);
      if (!points.length) return '<p class="note">没有足够的真实数据生成图表，请检查分组列和指标列。</p>';
      const width = 760;
      const height = 260;
      const left = 48;
      const bottom = 42;
      const chartWidth = width - left - 20;
      const chartHeight = height - bottom - 18;
      const max = Math.max.apply(null, points.map(item => item.value));
      const min = Math.min.apply(null, points.map(item => item.value));
      const range = max - min || 1;
      const step = chartWidth / Math.max(points.length, 1);
      const baseline = 18 + chartHeight;
      const shapes = chart.type === 'bar'
        ? points.map((point, itemIndex) => {
            const barHeight = ((point.value - min) / range) * (chartHeight - 16) + 16;
            const x = left + itemIndex * step + step * .18;
            const y = baseline - barHeight;
            return '<rect class="chart-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (step * .64).toFixed(1) + '" height="' + barHeight.toFixed(1) + '"></rect>' +
              '<text class="chart-label" x="' + (x + step * .32).toFixed(1) + '" y="' + (baseline + 18).toFixed(1) + '" text-anchor="middle">' + escapeText(point.label.slice(0, 12)) + '</text>';
          }).join('')
        : '<polyline class="chart-line" points="' + points.map((point, itemIndex) => {
            const x = left + itemIndex * step + step * .5;
            const y = baseline - (((point.value - min) / range) * (chartHeight - 16) + 16);
            return x.toFixed(1) + ',' + y.toFixed(1);
          }).join(' ') + '"></polyline>' +
          points.map((point, itemIndex) => {
            const x = left + itemIndex * step + step * .5;
            const y = baseline - (((point.value - min) / range) * (chartHeight - 16) + 16);
            return '<circle class="chart-point" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4"></circle>' +
              '<text class="chart-label" x="' + x.toFixed(1) + '" y="' + (baseline + 18).toFixed(1) + '" text-anchor="middle">' + escapeText(point.label.slice(0, 12)) + '</text>';
          }).join('');
      return '<div class="chart-box"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeText(chart.title) + '">' +
        '<line class="chart-axis" x1="' + left + '" y1="' + baseline + '" x2="' + (width - 20) + '" y2="' + baseline + '"></line>' +
        '<line class="chart-axis" x1="' + left + '" y1="18" x2="' + left + '" y2="' + baseline + '"></line>' + shapes + '</svg></div>';
    }
    function renderTable(rows) {
      if (!rows || !rows.length) return '<p class="note">没有可展示的真实数据。</p>';
      const columns = Object.keys(rows[0]);
      return '<div class="data-table-wrap"><table class="data-table"><thead><tr>' + columns.map(column => '<th>' + escapeText(column) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.slice(0, 20).map(row => '<tr>' + columns.map(column => '<td>' + escapeText(row[column] == null ? '' : String(row[column])) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div><p class="note">展示前 ' + Math.min(rows.length, 20) + ' 行真实数据。</p>';
    }
    function formatMetric(column) {
      if (!column) return '-';
      if (column.mean !== undefined) return String(Math.round(column.mean * 1000) / 1000);
      if (column.uniqueCount !== undefined) return String(column.uniqueCount);
      return '-';
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
  sectionEntries: AcademicDemoSectionEntry[];
}): AcademicDemoSection[] {
  const enabled = new Set(readSectionList(input.parameters.enabledSections, academicDemoSectionTypes));
  const sectionEntryByType = new Map(input.sectionEntries.map((entry) => [entry.type, entry] as const));
  const order = input.sectionEntries.length > 0
    ? input.sectionEntries.map((entry) => entry.type)
    : readSectionList(input.parameters.sectionOrder, academicDemoSectionTypes);
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
    const sectionEntry = sectionEntryByType.get(type);
    const blocks = readSectionBlocks(record.blocks, input.sources, type);
    const manualFieldBlocks = readManualContentFieldBlocks(type, sectionEntry?.contentFields);
    if (manualFieldBlocks.length > 0) {
      blocks.unshift(...manualFieldBlocks);
    }
    if (type === 'cover' && blocks.length === 0) {
      blocks.push({ type: 'text', id: 'cover-title', title: '项目名称', body: input.projectName });
    }
    if (sectionEntry?.manualContent?.trim()) {
      blocks.unshift({
        type: 'text',
        id: `manual-${type}`,
        title: '用户补充',
        body: sectionEntry.manualContent.trim(),
        evidence: {
          sourceRefs: [],
          confidence: 'high',
          extractionMethod: 'manual'
        }
      });
    }
    if (type === 'method_model') {
      blocks.push(...input.formulas.map((formula) => ({ type: 'formula' as const, id: `formula-block-${formula.id}`, formulaId: formula.id })));
    }
    if (type === 'data_analysis') {
      blocks.push(...input.charts.map((chart) => ({ type: 'chart' as const, id: `chart-block-${chart.id}`, chartId: chart.id })));
      blocks.push(...input.dataProfiles.slice(0, 4).map((profile, profileIndex) => ({
        type: 'metric' as const,
        id: `table-profile-${profileIndex + 1}`,
        label: profile.fileName,
        value: `${profile.rowCount} 行 / ${profile.columnCount} 列`
      })));
      if (sectionEntry?.dataComparison?.showTable !== false) {
        blocks.push(
          ...input.dataProfiles
            .filter((profile) => profile.previewRows && profile.previewRows.length > 0)
            .slice(0, 4)
            .map((profile) => ({
              type: 'table' as const,
              id: `table-preview-${profile.dataSourceId}`,
              title: `${profile.fileName} 数据预览`,
              rows: profile.previewRows ?? [],
              evidence: {
                sourceRefs: [{
                  sourceId: profile.dataSourceId,
                  fileName: profile.fileName,
                  fileType: profile.fileName.toLowerCase().endsWith('.csv') ? 'csv' as const : 'xlsx' as const,
                  columnNames: profile.columns.map((column) => column.name)
                }],
                confidence: 'high' as const,
                extractionMethod: 'local_parser' as const
              }
            }))
        );
      }
      if (input.parameters.enableInteractiveSimulation !== false) {
        blocks.push({ type: 'interactive', id: 'interactive-demo', simulationId: 'default-simulation' });
      }
    }

    return {
      id: `section-${type}`,
      type,
      title: sectionEntry?.title?.trim() || readString(record.title) || academicDemoSectionTitles[type],
      enabled: sectionEntry?.enabled ?? enabled.has(type),
      order: index + 1,
      depth: sectionEntry?.depth ?? input.parameters.sectionDepth?.[type] ?? 'standard',
      blocks
    };
  });
}

function readManualContentFieldBlocks(
  sectionType: AcademicDemoSectionType,
  fields: Record<string, string> | undefined
): AcademicDemoBlock[] {
  if (!fields) {
    return [];
  }

  const labels: Record<string, string> = {
    problemSource: '问题来源',
    industryPain: '行业痛点',
    academicValue: '学术价值',
    algorithmSummary: '算法思路',
    modelStructure: '模型结构',
    technicalRoute: '技术路线',
    datasetSource: '数据来源',
    sampleScale: '样本规模',
    variableFields: '变量字段',
    analysisNotes: '分析说明',
    experimentalConclusion: '实验结论',
    innovationPoints: '创新点',
    applicationValue: '应用价值',
    futureDirection: '后续方向'
  };

  return Object.entries(fields).flatMap(([key, body], index): AcademicDemoBlock[] => {
    const normalizedBody = body.trim();
    if (!normalizedBody) {
      return [];
    }
    return [{
      type: 'text',
      id: `manual-field-${sectionType}-${index + 1}`,
      title: labels[key] ?? key,
      body: normalizedBody,
      evidence: {
        sourceRefs: [],
        confidence: 'high',
        extractionMethod: 'manual'
      }
    }];
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

function readManualFormulaBlocks(value: AcademicFormulaDraft[] | undefined): AcademicFormulaBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index): AcademicFormulaBlock[] => {
    const latex = readString(item.latex);
    if (!latex) {
      return [];
    }

    return [{
      id: `manual-formula-${index + 1}`,
      latex,
      title: readString(item.title),
      explanation: readString(item.explanation),
      variables: item.variables?.filter((variable) => Boolean(variable.symbol?.trim() && variable.meaning?.trim())),
      evidence: {
        sourceRefs: [],
        confidence: 'high',
        extractionMethod: 'manual'
      }
    }];
  });
}

function mergeFormulaBlocks(
  manualFormulas: AcademicFormulaBlock[],
  extractedFormulas: AcademicFormulaBlock[]
): AcademicFormulaBlock[] {
  const seen = new Set<string>();
  return [...manualFormulas, ...extractedFormulas].flatMap((formula) => {
    const key = formula.latex.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [formula];
  });
}

function applyDataComparisonSettings(
  charts: AcademicChartSpec[],
  settings: AcademicDataComparisonSettings | undefined,
  dataProfiles: AcademicTableProfile[]
): AcademicChartSpec[] {
  if (!settings?.enabled || settings.chartType === 'table') {
    return charts;
  }

  const profile = dataProfiles.find((item) => {
    const columns = new Set(item.columns.map((column) => column.name));
    return (!settings.xColumn || columns.has(settings.xColumn)) &&
      (!settings.yColumn || columns.has(settings.yColumn));
  });
  const chart = charts.find((item) => item.dataSourceId === profile?.dataSourceId) ?? charts[0];
  if (!chart) {
    return charts;
  }

  return charts.map((item) => {
    if (item.id !== chart.id) {
      return item;
    }

    return {
      ...item,
      type: settings.chartType === 'bar' || settings.chartType === 'line' ? settings.chartType : item.type,
      title: settings.title?.trim() || item.title,
      x: settings.xColumn?.trim() || item.x,
      y: settings.yColumn?.trim() || item.y
    };
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
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if ((academicDemoSectionTypes as readonly string[]).includes(normalized)) {
    return normalized as AcademicDemoSectionType;
  }

  return legacyAcademicDemoSectionTypeMap[normalized];
}

function readSectionEntries(value: unknown): AcademicDemoSectionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed = value.flatMap((item, sourceIndex) => {
    if (!isRecord(item)) {
      return [];
    }

    const type = readSectionType(item.type);
    if (!type) {
      return [];
    }

    const order = readNumber(item.order);
    return [{
      type,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : undefined,
      order: Number.isFinite(order ?? NaN) ? order : undefined,
      title: readString(item.title),
      depth: item.depth === 'short' || item.depth === 'deep' ? item.depth : item.depth === 'standard' ? 'standard' : undefined,
      manualContent: readString(item.manualContent),
      contentFields: readStringMap(item.contentFields),
      formulaDrafts: readFormulaDrafts(item.formulaDrafts),
      dataComparison: readDataComparisonSettings(item.dataComparison),
      sourceIndex
    }];
  });

  if (parsed.length === 0) {
    return [];
  }

  const seen = new Set<AcademicDemoSectionType>();
  const explicitEntries = [...parsed]
    .sort((left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
      left.sourceIndex - right.sourceIndex
    )
    .flatMap((entry) => {
      if (seen.has(entry.type)) {
        return [];
      }
      seen.add(entry.type);
      return [{
        type: entry.type,
        enabled: entry.enabled ?? true,
        title: entry.title ?? academicDemoSectionTitles[entry.type],
        depth: (entry.depth ?? 'standard') as NonNullable<AcademicDemoPageEntry['depth']>,
        manualContent: entry.manualContent,
        contentFields: entry.contentFields,
        formulaDrafts: entry.formulaDrafts,
        dataComparison: entry.dataComparison
      }];
    });
  const missingEntries = academicDemoSectionTypes
    .filter((type) => !seen.has(type))
    .map((type) => ({
      type,
      enabled: true,
      title: academicDemoSectionTitles[type],
      depth: 'standard' as const,
      manualContent: undefined,
      contentFields: undefined,
      formulaDrafts: undefined,
      dataComparison: undefined
    }));

  return [...explicitEntries, ...missingEntries].map((entry, index) => ({
    ...entry,
    order: index + 1
  }));
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, item]) =>
    typeof item === 'string' && item.trim() ? [[key, item.trim()]] : []
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function readFormulaDrafts(value: unknown): AcademicFormulaDraft[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const drafts = value.flatMap((item): AcademicFormulaDraft[] => {
    const record = isRecord(item) ? item : {};
    const latex = readString(record.latex ?? record.formula);
    if (!latex) {
      return [];
    }

    return [{
      title: readString(record.title),
      latex,
      explanation: readString(record.explanation),
      variables: readFormulaVariables(record.variables)
    }];
  });

  return drafts.length > 0 ? drafts.slice(0, 20) : undefined;
}

function readDataComparisonSettings(value: unknown): AcademicDataComparisonSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const chartType =
    value.chartType === 'bar' || value.chartType === 'line' || value.chartType === 'table'
      ? value.chartType
      : 'auto';

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    title: readString(value.title),
    xColumn: readString(value.xColumn),
    yColumn: readString(value.yColumn),
    chartType,
    showTable: typeof value.showTable === 'boolean' ? value.showTable : true
  };
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
