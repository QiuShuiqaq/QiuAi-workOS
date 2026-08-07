# Spec: AI学术Demo工厂

## Objective

新增一个数字工厂：`AI学术Demo工厂`。

它面向学术项目、科研课题、算法竞赛、创新创业比赛和技术成果路演，帮助用户把 Word、PDF、Excel、CSV 等项目资料快速整理成一个可以在 PC 桌面端新窗口启动的本地软件演示 Demo。

这个工厂不是 PPT 生成器，也不是每次从 0 生成一个前端项目。它的目标是：

1. 用户上传项目资料后，系统保守提取明确可归类的信息。
2. 系统根据固定的学术项目演示结构生成 `demo-config.json` 草稿。
3. 用户可以对每个演示板块、公式、图表、表格、说明文字和交互参数做手动调整。
4. PC 端使用内置演示器打开一个新的演示窗口，用于现场投屏展示。
5. 最终产物保存在本地演示包中，方便复用、打包和现场携带。

成功标准：

- 新模板使用全新的 `templateId` 和由该模板生成的全新 `roleCode`。
- 不修改旧数字员工和旧数字工厂的流程、参数、产物定义。
- 所有 LLM 节点使用统一语义模型槽位，不写死供应商或模型。
- Word/PDF 文档可被解析并用于填入演示板块。
- Excel/CSV 可被解析并生成数据概况、图表和实验对比。
- 用户可以编辑、增删、排序每个板块中的内容。
- 启动演示时打开独立窗口，适合现场投屏。
- 旧数字员工和旧数字工厂仍能安装、配置、发起任务、产出产物。

## Assumptions

- 演示主要用于现场投屏，由演示人自己控制节奏。
- 第一版只支持本地启动和本地演示包，不提供公网分享链接。
- 上传文件和生成产物优先保存在 PC 本地，服务器只同步模板、授权和任务摘要等控制面数据。
- 文档解析、表格统计和图表数据生成尽量使用确定性本地逻辑；LLM 不负责做精确数值计算。
- LLM 负责信息提取、归类、解释文案和演示叙事草稿。
- 识别不到或证据不足的内容必须进入“待补充内容”，不能自动写入正式 Demo。
- Demo 演示器是 PC 端内置能力，不由 LLM 生成可执行代码。

## Non-Goals

- 不做 PPT 导出。
- 不做云端 Demo 发布链接。
- 不允许 AI 每次生成并执行新的前端项目代码。
- 不做自由拖拽式页面搭建器。
- 不做复杂动画编辑器。
- 不做论文查重、学术真实性背书或实验结论真实性认证。
- 不在服务端存储用户上传的项目原始文件、数据集或演示包。
- 不自动补造数据、公式、实验结果或引用来源。

## Product Identity

建议模板身份：

```text
templateId: factory_academic_project_demo_v1
applicationType: DIGITAL_FACTORY
dependencyManifestFactory.kind: academic_project_demo_factory
PC roleCode: ai-factory-academic-project-demo-v1
displayName: AI学术Demo工厂
recommendedPlanCode: ENTERPRISE_PRO_MONTHLY
```

说明：

- `roleCode` 由 PC 端现有 `createRoleCodeFromTemplateId` 规则从 `templateId` 派生。
- 不复用任何旧的 `factory_*`、`template_*` 或数字员工标识。
- 后续如果做垂直版本，例如医学科研 Demo、算法竞赛 Demo，也必须使用新的 `templateId`。

## Tech Stack

- `server`: NestJS, Prisma, shared role template catalog, canonical workflow graph.
- `pc-app`: Electron, React, TypeScript, local desktop runtime, local artifact storage.
- `admin-console`: 继续作为模板发布和同步入口，第一版不要求新建复杂拖拽能力。
- Workflow protocol: existing `workflowGraph` version `1.0.0`.
- Local tools: existing `office-document`, `local-filesystem`; add only narrowly scoped academic demo local utilities if required.
- Demo renderer: PC 端内置 React/Electron 演示窗口，读取 `demo-config.json`。

## Commands

Focused validation:

```powershell
npm run typecheck -w @qiuai/server
npm run test -w @qiuai/server
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/pc-app
```

Build validation:

```powershell
npm run build -w @qiuai/server
npm run build -w @qiuai/pc-app
```

Full deployment validation:

```powershell
npm run build:deploy
npm run check:deploy
```

Server deployment remains:

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 bash deploy/alicloud-ecs/start-pm2.sh
```

## Project Structure

Expected implementation ownership:

```text
apps/server/src/shared/
  role-template-catalog.ts
  role-template-catalog.test.ts
  workflow-graph.ts

apps/pc-app/src/shared/
  desktop-task-runner.ts
  desktop-role-requirements.ts
  desktop-workflow-graph.ts
  academic-demo-config.ts              # proposed typed config contract
  academic-demo-data-analysis.ts       # proposed deterministic table profiling

apps/pc-app/src/main/
  desktop-tool.ts
  desktop-tool-catalog.ts
  ipc.ts                               # proposed demo window IPC/open action if needed

apps/pc-app/src/renderer/
  App.tsx
  academic-demo/                       # proposed renderer components for editor and demo window

docs/
  AI_ACADEMIC_DEMO_FACTORY_SPEC.md
```

## User Workflow

1. 用户在数字市场安装 `AI学术Demo工厂`。
2. 用户进入数字工厂面板，上传项目资料：
   - Word: `.docx`
   - PDF: `.pdf`
   - Excel: `.xlsx`
   - CSV: `.csv`
3. 用户设置演示参数：
   - 项目类型
   - 演示时长
   - 目标观众
   - 演示风格
   - 启用板块
   - 板块排序
   - 每个板块内容量
   - 数据分析图表数量
   - 公式数量上限
   - 是否启用加载动画
   - 是否启用可视化交互
4. 工厂执行自动分析：
   - 本地提取文档文本。
   - 本地解析 Excel/CSV。
   - 本地生成数据概况和图表建议。
   - LLM 对明确内容做结构化归类。
5. 工厂生成 `demo-config.json` 草稿和识别报告。
6. 用户进入结构化编辑器，人工确认和调整每个板块。
7. 用户点击“启动演示”，PC 打开独立演示窗口。
8. 用户可导出本地演示包 ZIP。

## Input Design

### File Inputs

```ts
interface AcademicDemoFactoryInputFiles {
  documents: LocalFileRef[];      // docx, pdf
  spreadsheets: LocalFileRef[];   // xlsx, csv
}
```

Accepted file policy:

- Single run max files: 30.
- Single run max documents: 12.
- Single run max spreadsheets: 10.
- First version does not accept image, pptx, txt, or md inputs. These formats are deferred.
- Large files remain local. Server must not receive raw user files.

### Parameter Inputs

```ts
interface AcademicDemoFactoryParameters {
  projectName?: string;
  projectType: 'academic_research' | 'algorithm_competition' | 'innovation_competition' | 'technology_transfer' | 'other';
  audience: 'judges' | 'academic_reviewers' | 'enterprise_clients' | 'students' | 'mixed';
  demoDurationMinutes: 3 | 5 | 8 | 10 | 15;
  visualStyle: 'academic_clean' | 'tech_competition' | 'lab_system' | 'enterprise_research';
  enableLoadingAnimation: boolean;
  enableInteractiveSimulation: boolean;
  enabledSections: AcademicDemoSectionType[];
  sectionOrder: AcademicDemoSectionType[];
  sectionDepth: Record<AcademicDemoSectionType, 'short' | 'standard' | 'deep'>;
  maxFormulaCount: number;
  maxChartCount: number;
  maxExperimentComparisonCount: number;
  language: 'zh-CN' | 'en-US';
}
```

Default parameter policy:

- `demoDurationMinutes`: `5`
- `visualStyle`: `academic_clean`
- `enableLoadingAnimation`: `true`
- `enableInteractiveSimulation`: `true`
- `maxFormulaCount`: `8`
- `maxChartCount`: `8`
- `maxExperimentComparisonCount`: `6`
- `sectionDepth`: all `standard`

Parameter memory:

- PC 端应按 `roleCode` 记住上次使用的参数。
- “清空”只清空本次表单，不删除已生成的本地演示包。

## Demo Section Model

The first version supports exactly these section types:

```ts
type AcademicDemoSectionType =
  | 'cover'
  | 'research_background'
  | 'method_model'
  | 'formula_reference'
  | 'dataset_overview'
  | 'data_analysis'
  | 'experiment_comparison'
  | 'interactive_visualization'
  | 'conclusion_value';
```

### Section Requirements

| Section | Required Content | Optional Content | Auto Fill Rule |
| --- | --- | --- | --- |
| 项目首页 | 项目名称、研究方向、关键词、核心结论 | 单位/团队、Logo、封面图 | 必须有明确标题或用户手填 |
| 研究背景 | 问题来源、研究意义 | 行业痛点、学术价值、应用场景 | 只从摘要、引言、背景章节提取 |
| 方法模型 | 算法思路、模型结构、技术路线 | 流程图、模块图、伪代码 | 只从方法、模型、技术路线章节提取 |
| 公式引用 | LaTeX 公式、公式解释 | 变量说明、来源页码 | 只收录明确公式或用户手填公式 |
| 数据集说明 | 数据来源、样本规模、字段 | 缺失率、分布、采样方法 | Excel/CSV 统计优先，文档描述辅助 |
| 数据分析 | 指标、图表、趋势 | 对比表、异常点、统计摘要 | 数值由本地程序生成，解释由 LLM 生成 |
| 实验对比 | 方法/参数/模型对比 | 指标排名、消融实验 | 只从明确实验表格或用户指定表格生成 |
| 可视化演示 | 参数滑块、输入样例、模拟结果 | 加载动画、状态切换 | 第一版为模拟演示，不执行真实算法 |
| 结论与价值 | 结论、创新点、应用价值 | 后续方向、落地价值 | 必须可追溯到文档结论或用户手填 |

## Conservative Extraction Policy

Automatic extraction must be conservative.

Every auto-filled block must include:

```ts
interface AcademicDemoSourceRef {
  sourceId: string;
  fileName: string;
  fileType: 'docx' | 'pdf' | 'xlsx' | 'csv';
  page?: number;
  sheetName?: string;
  rowRange?: string;
  columnNames?: string[];
  excerpt?: string;
}

interface AcademicDemoEvidence {
  sourceRefs: AcademicDemoSourceRef[];
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: 'local_parser' | 'llm_structured_extraction' | 'vision' | 'manual';
}
```

Auto-fill rules:

- `high`: can enter the Demo draft.
- `medium`: can enter the Demo draft but must be visually marked as “建议复核”.
- `low`: must go to “待补充内容”, not the formal Demo section.
- no `sourceRefs`: cannot auto-fill, unless the content is manually entered by the user.
- LLM-generated explanatory text must keep a link to the data block or source block it explains.
- LLM must not invent formulas, datasets, experiment metrics, accuracy numbers, improvement percentages, paper names, references, organizations, or team names.

## Data Analysis Design

Excel/CSV analysis uses deterministic local processing first.

### Local Table Profiling

```ts
interface AcademicTableProfile {
  dataSourceId: string;
  fileName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  columns: AcademicColumnProfile[];
  warnings: AcademicDataWarning[];
}

interface AcademicColumnProfile {
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
```

### Chart Recommendation

```ts
type AcademicChartType =
  | 'metric_cards'
  | 'bar'
  | 'line'
  | 'scatter'
  | 'box'
  | 'histogram'
  | 'heatmap'
  | 'comparison_table';

interface AcademicChartSpec {
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
```

Chart rules:

- 数值计算由本地程序完成。
- LLM 只生成图表标题、图表解释和演示讲解词。
- 如果字段类型识别不明确，不自动生成复杂图表。
- 如果表格只有文本列，只生成字段概况和样本预览，不生成趋势图。

## Demo Config Contract

The generated demo package centers on `demo-config.json`.

```ts
interface AcademicDemoConfig {
  schemaVersion: '1.0.0';
  demoId: string;
  generatedAt: string;
  factoryTemplateId: 'factory_academic_project_demo_v1';
  roleCode: 'ai-factory-academic-project-demo-v1';
  project: AcademicDemoProject;
  presentation: AcademicDemoPresentationSettings;
  sources: AcademicDemoSource[];
  sections: AcademicDemoSection[];
  charts: AcademicChartSpec[];
  formulas: AcademicFormulaBlock[];
  dataProfiles: AcademicTableProfile[];
  assets: AcademicDemoAsset[];
  unresolvedItems: AcademicDemoUnresolvedItem[];
}

interface AcademicDemoProject {
  name: string;
  researchDirection?: string;
  keywords: string[];
  organization?: string;
  team?: string;
  coreConclusion?: string;
}

interface AcademicDemoPresentationSettings {
  visualStyle: AcademicDemoFactoryParameters['visualStyle'];
  language: AcademicDemoFactoryParameters['language'];
  enableLoadingAnimation: boolean;
  enableInteractiveSimulation: boolean;
  autoPlay: boolean;
  durationMinutes: number;
}

interface AcademicDemoSection {
  id: string;
  type: AcademicDemoSectionType;
  title: string;
  enabled: boolean;
  order: number;
  depth: 'short' | 'standard' | 'deep';
  blocks: AcademicDemoBlock[];
  evidence?: AcademicDemoEvidence;
}
```

Block types:

```ts
type AcademicDemoBlock =
  | { type: 'text'; id: string; title?: string; body: string; evidence?: AcademicDemoEvidence }
  | { type: 'metric'; id: string; label: string; value: string | number; unit?: string; evidence?: AcademicDemoEvidence }
  | { type: 'formula'; id: string; formulaId: string }
  | { type: 'chart'; id: string; chartId: string }
  | { type: 'table'; id: string; title: string; rows: Array<Record<string, unknown>>; evidence?: AcademicDemoEvidence }
  | { type: 'process'; id: string; steps: Array<{ title: string; description?: string }>; evidence?: AcademicDemoEvidence }
  | { type: 'interactive'; id: string; simulationId: string };
```

Formula block:

```ts
interface AcademicFormulaBlock {
  id: string;
  latex: string;
  title?: string;
  explanation?: string;
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>;
  evidence: AcademicDemoEvidence;
}
```

Unresolved item:

```ts
interface AcademicDemoUnresolvedItem {
  id: string;
  targetSectionType: AcademicDemoSectionType;
  reason: 'low_confidence' | 'missing_source' | 'ambiguous_section' | 'unsupported_format' | 'needs_manual_input';
  suggestion: string;
  candidateText?: string;
  sourceRefs?: AcademicDemoSourceRef[];
}
```

## Workflow Graph Design

Use the existing canonical `workflowGraph` protocol.

Proposed node sequence:

1. `start`
2. `factory_input` (`input`)
3. `extract_documents` (`tool`)
4. `profile_tables` (`tool` or deterministic `data`)
5. `extract_academic_sections` (`llm`)
6. `build_demo_config` (`data`)
7. `write_demo_config` (`tool`)
8. `package_demo_assets` (`tool`)
9. `factory_output` (`output`)

### LLM Nodes

All LLM nodes must use semantic model slots:

| Node | modelProfileId | llmTaskType | Purpose |
| --- | --- | --- | --- |
| `extract_academic_sections` | `qiu-general-default` | `structured_extraction` | 从文档文本中保守提取板块内容 |
| `generate_demo_narration` if separated | `qiu-general-default` | `text` | 生成讲解词和板块说明 |

Rules:

- Do not use provider IDs such as `deepseek`, `openai`, `aliyun-bailian`, `grsai`, or concrete model names in workflow nodes.
- Do not use vision, image generation, video generation, ASR, embedding, or rerank slots in V1.
- Every LLM node must explicitly define `config.llmTaskType`.
- If a node requires more than one semantic slot, use `config.requiredModelProfileIds`.

## Dependency Manifest

Proposed factory manifest:

```ts
interface AcademicProjectDemoFactoryManifest {
  kind: 'academic_project_demo_factory';
  batch: {
    maxItems: 50;
    itemSource: 'project_materials';
  };
  inputFileKinds: ['document', 'pdf', 'spreadsheet', 'csv'];
  documentExtensions: ['docx', 'pdf'];
  tableExtensions: ['xlsx', 'csv'];
  demo: {
    schemaVersion: '1.0.0';
    sectionTypes: AcademicDemoSectionType[];
    defaultSectionOrder: AcademicDemoSectionType[];
    editable: true;
    launchMode: 'electron_demo_window';
    packageFormat: 'zip';
  };
  requiredCapabilities: ['text', 'document_extract', 'spreadsheet_read', 'local_file_write'];
  optionalCapabilities: [];
}
```

The server template test must add `academic_project_demo_factory` to the known factory manifest kinds.

## PC UI Requirements

The factory operation panel should reuse the existing digital factory layout:

- Left top: input upload.
- Left middle/bottom: parameter settings.
- Middle top: task queue.
- Middle middle/bottom: output queue.
- Right top: model and tool status.
- Right middle/bottom: work logs.

### New UI Requirements For This Factory

Output queue should show:

- `Demo 草稿`
- `识别报告`
- `数据分析图表`
- `公式清单`
- `待补充内容`
- `本地演示包`

Actions:

- `编辑Demo内容`
- `启动演示`
- `打开本地文件夹`
- `打包导出`
- `重新生成草稿`

The editor must allow:

- Enable/disable sections.
- Reorder sections.
- Edit section title and content.
- Add/delete/reorder text blocks.
- Add/delete/reorder formulas.
- Edit LaTeX formula and explanation.
- Add/delete/reorder charts selected from generated chart specs.
- Edit chart title and explanation.
- Mark unresolved items as ignored or manually filled.

## Demo Window Requirements

The demo window is a separate Electron window.

Required layout:

- Top: project title, demo status, full-screen button.
- Left: section navigation.
- Center: active section content.
- Right: formula/data/source panel, collapsible.
- Bottom: previous/next controls and progress.

Required interaction:

- Keyboard left/right for previous/next.
- `F11` or UI button for full-screen.
- `Esc` exits full-screen or closes overlay.
- Data analysis section supports chart switching.
- Formula section supports formula card expansion.
- Interactive section supports sliders, input sample, run button, and simulated result.

Loading animation:

- Must be optional.
- Must be deterministic UI animation, not a fake long wait.
- Must not block navigation for more than the configured animation duration.

## Output Design

Final factory outputs:

```text
academic-demo/
  demo-config.json
  sources/
    source-index.json
  assets/
    charts/
  reports/
    识别报告.md
    待补充内容.md
  spreadsheets/
    数据分析摘要.xlsx
  demo-package.zip
```

The PC output queue must show both:

- high-level final artifacts: demo entry, package zip, reports.
- reviewable output objects: each section, each chart, each formula, each unresolved item.

## Security And Privacy

- Raw uploaded documents, spreadsheets, generated charts, and demo packages stay on the user's PC.
- Server must not receive raw files.
- If task summary sync is needed, sync only metadata: templateId, roleCode, task status, artifact names, timestamps, and non-sensitive summary.
- Do not execute generated code.
- Do not allow arbitrary HTML/JS from LLM output.
- Demo renderer must render only validated `demo-config.json` blocks.
- V1 formula display uses plain-text LaTeX with copy-friendly formatting. Do not add a formula rendering dependency in V1.
- External links from documents must not be auto-opened.

## Compatibility Boundaries

Always:

- Use new `templateId` and new generated `roleCode`.
- Keep old digital employee and old digital factory templates unchanged.
- Use canonical workflow graph node types.
- Use semantic model slots and explicit `llmTaskType`.
- Validate `demo-config.json` before rendering.
- Store large artifacts locally.
- Add regression tests when shared logic changes.

Ask first:

- Database schema changes.
- New npm dependencies.
- New third-party charting, formula rendering, or document parsing libraries.
- Any change to existing factory output queue behavior shared by all factories.
- Any server-side storage of user project files.

Never:

- Hardcode a supplier or concrete model in the template.
- Let LLM-generated code execute.
- Auto-fill low-confidence or source-less academic claims into formal Demo sections.
- Modify old factory package definitions or old workflow nodes without explicit approval.
- Replace the existing digital factory workflow protocol.

## Testing Strategy

Server tests:

- `role-template-catalog.test.ts`
  - New template exists.
  - `applicationType` is `DIGITAL_FACTORY`.
  - `templateId` is `factory_academic_project_demo_v1`.
  - Factory manifest kind is `academic_project_demo_factory`.
  - Batch maxItems remains `50`.
  - Every LLM node has semantic `modelProfileId`.
  - Every LLM node has explicit `llmTaskType`.
  - Old factory template IDs still exist.
  - Old factory names and manifest kinds remain unchanged.

PC shared tests:

- Demo config parser accepts valid config and rejects invalid block types.
- Conservative extraction policy keeps low-confidence content in unresolved items.
- Table profiling infers number/category/date/text columns.
- Chart recommendation does not create trend charts for non-date text-only tables.
- Factory requirements detect `qiu-general-default`.
- Existing image, video, quality video, and operation video factories still resolve model slots.

PC renderer/manual validation:

- Install `AI学术Demo工厂`.
- Configure text model slot.
- Upload one docx/pdf and one xlsx/csv.
- Run factory.
- Confirm output queue includes Demo draft,识别报告,图表,公式,待补充内容,演示包.
- Edit at least one section, one formula, and one chart title.
- Launch demo window.
- Use left/right keys and full-screen.
- Export package zip.
- Reopen generated demo from local package.

Regression checklist:

- AI电商图片工厂 can install, configure, run, and output images.
- AI电商视频工厂 can install, configure, run, and output videos.
- AI质检视频工厂 can install, configure, run, and output qualified list / optional rough cut.
- AI 运营视频工厂 can install, configure, run, and output package artifacts.
- Basic free digital employees can install and generate their expected artifacts.

## Implementation Plan

Phase 1: Template and contracts

- Add `AcademicDemoConfig` parser and types.
- Add server template entry with new `templateId`.
- Add factory manifest kind to validation/tests.
- Add regression tests for semantic model slots and old template preservation.

Phase 2: Local extraction and data profiling

- Reuse existing document extraction for docx/pdf.
- Add deterministic table profiling for xlsx/csv if current extraction is not enough.
- Generate `AcademicTableProfile` and `AcademicChartSpec`.

Phase 3: Workflow runner integration

- Add factory-specific execution branch for `academic_project_demo_factory`.
- Generate `demo-config.json`, recognition report, unresolved items, and package zip.
- Keep all outputs local.

Phase 4: PC factory editor

- Add structured Demo editor in output queue.
- Support section/block/formula/chart editing.
- Persist edits in the local demo package.

Phase 5: Demo window

- Add Electron demo window launch IPC.
- Render validated `demo-config.json`.
- Add projection-friendly navigation, full-screen, chart switching, formula expansion, and simple interactive simulation.

Phase 6: Regression and packaging

- Run server and PC tests.
- Manually verify old factories and basic workers.
- Package Windows build only after factory and regressions pass.

## Success Criteria

- A user can upload at least one project document and one data table, run the factory, edit the draft, and launch a local demo window.
- The demo window contains the 9 supported academic sections, with user-controlled enablement and ordering.
- Data analysis uses real Excel/CSV data, not invented values.
- Low-confidence extracted content is not inserted into formal sections.
- Formula blocks support plain-text LaTeX editing, copy, and explanation.
- Output queue exposes every generated section, chart, formula, unresolved item, and final package.
- No old template identifiers, workflow steps, parameters, or output definitions are changed.
- Model configuration is controlled through PC “当前调用模型”, not through hardcoded provider/model names.

## Confirmed Scope Decisions

1. 第一版只支持 Word/PDF/Excel/CSV 输入，不支持 PPTX、图片、TXT、Markdown。
2. 演示窗口只展示 Demo 页面，不做讲解词提词器。
3. 数据图表第一版使用内置 SVG/HTML 图表，不引入新的图表库。
4. 公式渲染第一版使用纯文本 LaTeX 展示，提供清晰排版、解释和复制能力；暂不引入专业公式渲染库。
5. 生成的 Demo 包不做版本历史，只保留最新版本；重新生成会覆盖当前工厂实例的最新演示包。
