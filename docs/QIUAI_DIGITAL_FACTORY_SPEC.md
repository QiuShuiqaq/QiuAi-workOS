# Spec: QiuAI Digital Factory

## Objective

Build "数字工厂" as QiuAI WorkOS's second first-class application type after "数字员工".

Digital employees handle mostly single-task, conversation-like work such as document整理, table整理, and report writing. Digital factories handle batch production workflows such as ecommerce product image production, batch video processing, batch spreadsheet cleanup, and batch marketing asset generation.

The first factory is:

- `跨境商品图工厂`

It targets cross-border ecommerce teams that need to turn one or more product reference images into batches of marketplace-ready images.

Success means:

1. Admin operators can create, test, publish, and manage digital factories from `admin-console`.
2. Digital factories reuse the existing canonical `workflowGraph` protocol instead of introducing a second workflow DSL.
3. PC users can install and run a factory through a batch production UI, not a normal chat-only task UI.
4. The first factory supports 7 selectable product packages: white background, main image, scene image, background replacement, model replacement, dimension image, and selling-point image.
5. All model calls, including text, vision, image generation, and image editing, use customer-configured model profiles. QiuAI does not proxy, hide, resell, or charge for model calls in this phase.
6. Large images never move through the QiuAI server. Source images are local PC references, generated images are upstream URL metadata, and the server stores only control-plane metadata when sync is needed.
7. Existing digital employee authoring, installation, execution, and artifact behavior continue to work.

## Assumptions

- `workflowGraph` version `1.0.0` remains the only canonical workflow contract.
- ADR-019 is authoritative: model execution is always `llm`, and capability is selected through `llm.config.llmTaskType`.
- Digital factory creation is controlled by `admin-console`; normal enterprise users do not author factories.
- PC desktop is the execution surface for real local files, generated image URL previews, optional local caching/save-as, batch progress, and retry.
- `web-console` does not author factories. It may later show enterprise usage, but it is out of scope for Factory V1.
- All model credentials are configured by the customer in PC model configuration.
- No AI points, payment, platform-hosted upstream channel, or model resale is included in Factory V1.
- Single factory batch size is capped at 50 product items.
- Generated product images are first represented as upstream `remoteUrl` metadata. The PC may cache or save selected images locally, and local caches follow the existing 30-day artifact cache policy.
- New factory definitions win when they conflict with old template meanings; existing digital employee behavior must not be broken.

## Non-Goals

- Do not build a separate workflow protocol for factories.
- Do not implement AI points, Alipay, billing orders, model resale, or platform-hosted image generation in this phase.
- Do not store product images or generated images on the server.
- Do not expose the work canvas to normal enterprise PC users.
- Do not require users to write complex prompts for common ecommerce image operations.
- Do not make the first version a full image editor like Photoshop.
- Do not guarantee platform compliance review for every marketplace rule. Platform presets are generation guidance, not legal/compliance certification.

## Tech Stack

- `admin-console`: Next.js, React, TypeScript, Ant Design, `@xyflow/react`
- `server`: NestJS, Prisma, PostgreSQL
- `pc-app`: Electron, React, TypeScript, local desktop runtime, local artifact storage
- Shared workflow contract: current `workflowGraph` protocol in server/admin/PC code
- Local artifacts: existing desktop artifact cache and save/export mechanisms

## Commands

Development:

```powershell
npm run dev:server
npm run dev:admin
npm run dev:pc
```

Focused validation:

```powershell
npm run prisma:generate -w @qiuai/server
npm run typecheck -w @qiuai/server
npm run typecheck -w @qiuai/admin-console
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/server
npm run test -w @qiuai/pc-app
```

Build validation:

```powershell
npm run build -w @qiuai/server
npm run build -w @qiuai/admin-console
npm run build -w @qiuai/pc-app
```

Server deployment should continue to use the existing server script with Electron download skipped:

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 bash deploy/alicloud-ecs/start-pm2.sh
```

## Project Structure

Expected implementation ownership:

```text
apps/server/
  prisma/schema.prisma
  src/shared/workflow-graph.ts
  src/modules/role-template-factory/
  src/modules/desktop-sync/

apps/admin-console/
  src/shared/console/AdminShell.tsx
  src/app/templates/
  src/app/templates/canvas/
  src/features/templates/
  src/features/assets/

apps/pc-app/
  src/shared/desktop-workflow-graph.ts
  src/shared/desktop-task-runner.ts
  src/shared/desktop-api.ts
  src/main/artifact-store.ts
  src/renderer/

docs/
  QIUAI_DIGITAL_FACTORY_SPEC.md
  QIUAI_WORKFLOW_CANVAS_1_SPEC.md
  decisions/ADR-019-workflow-graph-canonical-protocol.md
```

## Product Model

### Application Types

Role templates become a broader "application template" concept:

```ts
type QiuApplicationType = 'digital_employee' | 'digital_factory';
```

The existing `RoleTemplate` table may remain the persistence model, but it needs a first-class logical type:

- `digital_employee`: current behavior.
- `digital_factory`: batch production app built on the same workflow graph.

Implementation preference:

1. Add an explicit database field such as `applicationType` with default `DIGITAL_EMPLOYEE`.
2. Use this field in admin lists, desktop catalog responses, installation metadata, and PC rendering.
3. During rollout, existing records default to `DIGITAL_EMPLOYEE`.

If a transitional implementation stores this in `dependencyManifest.applicationType`, the final product path still treats explicit `applicationType` as the new definition. When top-level and manifest values conflict, top-level `applicationType` wins.

### Digital Employee

Single task model:

```text
task input -> one workflow run -> final response and artifacts
```

PC user experience:

- Chat/task panel.
- Compact progress messages.
- Artifact cards.
- Advanced logs in the log panel.

### Digital Factory

Batch production model:

```text
factory batch -> item/package tasks -> concurrent image generation -> URL preview results -> optional local save/cache
```

PC user experience:

- Factory operation panel.
- Batch upload.
- Marketplace selection.
- Product package multi-select.
- Model readiness check.
- Batch progress table.
- Per-item retry and rework.
- Ordered thumbnail preview, click-to-enlarge, and optional local save/cache.

Digital factories are not "more powerful chats"; they are batch production tools.

## Workflow Graph Boundary

Factories reuse `workflowGraph` version `1.0.0`.

No new canonical node types are required for Factory V1. Use the existing canonical nodes:

- `start`
- `input`
- `tool`
- `llm`
- `data`
- `condition`
- `iteration`
- `aggregator`
- `artifact`
- `output`

Factory behavior is represented by:

- Template-level `applicationType = digital_factory`.
- Factory-specific runtime configuration in `dependencyManifest.factory`.
- Standard factory variables in `workflowGraph.variables`.
- Existing `iteration` and `condition` nodes for batch and selected package routing.

### Factory Manifest

Each factory template should include:

```ts
interface QiuFactoryManifest {
  applicationType: 'digital_factory';
  factory: {
    kind: 'cross_border_product_image';
    batch: {
      maxItems: 50;
      itemSource: 'images' | 'images_with_sku_table';
      allowMultipleReferenceImagesPerItem: boolean;
    };
    platforms: QiuFactoryPlatformPreset[];
    packages: QiuFactoryProductPackage[];
    qualityCheck: QiuFactoryQualityCheckPolicy;
    output: QiuFactoryOutputPolicy;
    requiredCapabilities: QiuFactoryRequiredCapability[];
  };
}
```

Factory manifest is product/runtime metadata. It does not replace `workflowGraph`.

### Standard Factory Variables

The following variables are reserved for digital factories:

```text
factory.batchId
factory.name
factory.platform
factory.selectedPackages
factory.userInstruction
factory.qualityCheckMode
factory.outputFormat
factory.outputAspectRatio
factory.packageQuantity
factory.retryCount
factory.items
factory.results
factory.previewItems
factory.remoteUrlManifest

item.index
item.sku
item.productName
item.category
item.dimensions
item.color
item.sellingPoints
item.sourceImage
item.referenceImages
item.sourceFiles

package.current
package.instructions
package.generatedImage
package.qcResult
package.remoteUrl
package.localCachePath
```

Rule:

- These names are system-reserved in factory templates.
- Admin UI should offer them through the variable picker.
- Operators can add custom variables, but custom variables must not override reserved factory variables.
- If old template variables conflict with these reserved variables inside a `digital_factory`, the reserved definition wins.

## Cross-Border Product Image Factory V1

### Target Users

- Cross-border ecommerce operators.
- Product listing teams.
- Small ecommerce sellers that need fast SKU image production.
- Agency teams producing product image batches for clients.

### Supported Platforms

V1 includes 10 platform presets:

- Amazon
- Temu
- TikTok Shop
- AliExpress / 速卖通
- Shopee
- Lazada
- Shopify
- eBay
- Ozon
- Walmart Marketplace

Preset scope:

- Default aspect ratio.
- Recommended output size.
- Main image style preference.
- Whether text is allowed by default.
- File naming hints.
- Package recommendation.

Preset non-scope:

- It does not certify that every generated image passes marketplace policy review.
- It does not replace operator review.

### Batch Input

PC input supports:

- 1 to 50 product items per batch.
- Product images: `png`, `jpg`, `jpeg`, `webp`.
- Optional SKU table: `xlsx`, `csv`.
- Optional user instruction text.
- Optional per-item product name, category, dimensions, color, selling points.

Each product item may have:

```ts
interface FactoryProductItemInput {
  index: number;
  sku?: string;
  productName?: string;
  category?: string;
  dimensions?: string;
  color?: string;
  sellingPoints?: string[];
  sourceImage: QiuAssetRef;
  referenceImages?: QiuAssetRef[];
}
```

Large source files remain local asset refs. Generated images are represented by upstream `remoteUrl`/`thumbnailPath` metadata until the PC explicitly caches or saves them. Nodes pass paths and URL metadata, not raw image bytes or base64 payloads.

### Runtime Options

Each factory run supports:

```ts
interface CrossBorderImageFactoryRunOptions {
  platform: string;
  selectedPackages: FactoryImagePackageKey[];
  qualityCheckMode: 'none' | 'basic' | 'smart';
  packageQuantity: 1 | 2 | 3;
  retryCount: 0 | 1 | 2;
  outputFormat: 'png' | 'jpg';
  outputAspectRatio: '1:1' | '4:5' | '3:4' | '16:9';
  allowMinorBeautification: boolean;
  userInstruction?: string;
}
```

Defaults:

- `qualityCheckMode = basic`
- `packageQuantity = 1`
- `retryCount = 1`
- `outputFormat = png`
- `outputAspectRatio = 1:1`
- `allowMinorBeautification = true`

### Selectable Product Packages

Users select only the packages they need. Nothing is forced.

```ts
type FactoryImagePackageKey =
  | 'white_background'
  | 'main_image'
  | 'scene_image'
  | 'background_replacement'
  | 'model_replacement'
  | 'dimension_image'
  | 'selling_point_image';
```

V1 includes all 7:

1. 白底图
2. 商品主图
3. 场景图
4. 换背景
5. 换模特
6. 尺寸图
7. 卖点图

### Quality Check

Quality check is optional because smart quality check may call a multimodal model and increase customer cost.

Modes:

```ts
type FactoryQualityCheckMode = 'none' | 'basic' | 'smart';
```

`none`:

- No quality check after generation.
- Fastest and cheapest.

`basic`:

- Does not call an LLM.
- Checks result count, SKU/package coverage, URL presence, URL shape, failed items, and local cache metadata if a generated image has already been cached.

`smart`:

- Calls the user's configured multimodal model.
- Compares original image, generated image, package goal, platform preset, and user instruction.
- Returns pass/warn/fail and reason.
- Failed items can be marked for retry or manual review.

Smart QC output:

```ts
interface FactorySmartQualityCheckResult {
  status: 'pass' | 'warning' | 'fail';
  score?: number;
  reasons: string[];
  suggestedFix?: string;
}
```

## Workflow Nodes For Cross-Border Product Image Factory

The authoring canvas should present a readable business flow while storing canonical nodes.

Recommended stored graph:

```text
start
  -> factory_input
  -> parse_sku_table
  -> prepare_platform_rules
  -> build_factory_items
  -> iterate_items
       -> generate_package_instructions
       -> route_selected_packages
          -> white_background_branch
          -> main_image_branch
          -> scene_image_branch
          -> background_replacement_branch
          -> model_replacement_branch
          -> dimension_image_branch
          -> selling_point_image_branch
       -> optional_quality_check
       -> collect_item_artifacts
  -> aggregate_batch_results
  -> build_preview_manifest
  -> factory_output
```

### 1. Factory Input

Canonical node:

- `input`

Purpose:

- Normalize uploaded product images, optional SKU table, selected platform, selected packages, and run options.

Inputs:

- `start.text`
- `start.files`
- PC factory form values

Outputs:

- `factory.platform`
- `factory.selectedPackages`
- `factory.userInstruction`
- `factory.qualityCheckMode`
- `factory.packageQuantity`
- `factory.retryCount`
- `factory.outputFormat`
- `factory.outputAspectRatio`
- `factory.sourceFiles`

### 2. Parse SKU Table

Canonical node:

- `tool` or `data`

Purpose:

- Read optional SKU table and normalize rows to product item metadata.

Rules:

- If no SKU table exists, return empty metadata and continue.
- Do not fail the whole batch because SKU table is absent.

Outputs:

- `factory.skuRows`

### 3. Prepare Platform Rules

Canonical node:

- `data`

Purpose:

- Resolve selected marketplace preset into concrete generation constraints.

Outputs:

- `factory.platformSpec`

Example:

```json
{
  "platform": "Amazon",
  "defaultAspectRatio": "1:1",
  "recommendedSize": "2000x2000",
  "mainImagePreference": "clean product image",
  "allowTextOnMainImage": false
}
```

### 4. Build Factory Items

Canonical node:

- `data`

Purpose:

- Pair uploaded product images with optional SKU rows and produce a maximum of 50 item records.

Rules:

- Hard fail if item count is 0.
- Hard fail if item count is greater than 50.
- If SKU table has fewer rows than images, keep processing images and leave missing fields empty.
- If SKU table has more rows than images, warn and ignore unmatched rows.

Outputs:

- `factory.items`

### 5. Iterate Items

Canonical node:

- `iteration`

Purpose:

- Process each product item.

Config:

```json
{
  "sourceVariable": "factory.items",
  "currentItemVariable": "item",
  "maxIterations": 50,
  "continueOnError": true
}
```

Outputs:

- `factory.itemResults`

### 6. Generate Package Instructions

Canonical node:

- `llm`

LLM task type:

- `vision`

Purpose:

- Use one multimodal LLM call to inspect the item source image and generate structured prompts/instructions for the selected packages.

This combines image understanding and prompt generation. It is intentionally not split into separate nodes in V1.

Inputs:

- `item.sourceImage`
- `item.referenceImages`
- `item.productName`
- `item.category`
- `item.dimensions`
- `item.sellingPoints`
- `factory.platformSpec`
- `factory.selectedPackages`
- `factory.userInstruction`

Output mode:

- `json`

Outputs:

- `package.instructions`

Required JSON shape:

```ts
interface FactoryPackageInstructions {
  productSummary: {
    productType?: string;
    mainObject: string;
    visibleFeatures: string[];
    keepRules: string[];
    riskNotes: string[];
  };
  packagePrompts: Partial<Record<FactoryImagePackageKey, {
    prompt: string;
    negativePrompt?: string;
    textOverlays?: {
      headline?: string;
      bullets?: string[];
    };
    requiredInputs?: string[];
    skipReason?: string;
  }>>;
}
```

Important rules:

- Only generate prompts for `factory.selectedPackages`.
- Keep product structure and identity stable.
- Do not invent dimensions, certification marks, brand logos, or unsupported claims.
- For `dimension_image`, use only provided dimensions.
- For `selling_point_image`, use only provided selling points or clearly observable features.

### 7. Route Selected Packages

Canonical node:

- `condition`

Purpose:

- Execute only package branches selected by the user.

Condition source:

- `factory.selectedPackages`

Branches:

- `white_background`
- `main_image`
- `scene_image`
- `background_replacement`
- `model_replacement`
- `dimension_image`
- `selling_point_image`

### 8. Package Branches

Each branch uses the same node shape:

```text
package condition
  -> package generation
  -> optional package quality check
  -> package artifact save
```

#### A. White Background

Goal:

- Keep the exact product and place it on a pure white background.

Generation node:

- `llm`
- `llmTaskType = image_generation`
- Inputs: `item.sourceImage`, `package.instructions.packagePrompts.white_background`

Artifact:

- `artifact`
- `artifactType = png | jpg`
- File name template: `{sku_or_index}_white.{ext}`

#### B. Main Image

Goal:

- Produce a marketplace-ready main product image.

Generation node:

- `llm`
- `llmTaskType = image_generation`

Rules:

- Follow selected platform preset.
- Avoid extra text if platform preset disallows text.
- Preserve product identity.

Artifact:

- `{sku_or_index}_main.{ext}`

#### C. Scene Image

Goal:

- Place product into a realistic usage scene.

Generation node:

- `llm`
- `llmTaskType = image_generation`

Rules:

- Scene must match product category and user instruction.
- Do not change core product appearance.

Artifact:

- `{sku_or_index}_scene_01.{ext}`

#### D. Background Replacement

Goal:

- Replace background while preserving product subject.

Generation node:

- `llm`
- `llmTaskType = image_generation`

Rules:

- Keep product unchanged.
- Improve background only.

Artifact:

- `{sku_or_index}_background_01.{ext}`

#### E. Model Replacement

Goal:

- Generate model usage/display image.

Generation node:

- `llm`
- `llmTaskType = image_generation`

Rules:

- User may specify model gender, age range, region style, pose, scene, and whether the face is visible.
- Keep the original product visible and recognizable.
- Reject unsafe, explicit, or sensitive model instructions.

Artifact:

- `{sku_or_index}_model_01.{ext}`

#### F. Dimension Image

Goal:

- Generate product dimension image using real provided dimensions.

Precondition node:

- `condition` or `data`

Rules:

- If dimensions are missing, skip this package for the item and return a clear missing-input message.
- Never let the model guess dimensions.

Generation strategy:

- V1 may use `llmTaskType = image_generation` with strict image-to-image instructions.
- A later stability pass should prefer a deterministic local image composition tool for dimension labels and arrows.

Artifact:

- `{sku_or_index}_dimension.{ext}`

#### G. Selling-Point Image

Goal:

- Generate a marketing image with selling points.

Generation strategy:

- Use `llm` text/vision output for copy in `package.instructions`.
- Prefer local composition for text overlays when available.
- If using image model for text, warn that text may need manual review.

Rules:

- Do not invent claims.
- Do not add fake certification, medical, safety, or platform badges.

Artifact:

- `{sku_or_index}_selling_01.{ext}`

### 9. Optional Quality Check

Canonical node:

- `condition` + `tool` or `llm`

Input:

- `factory.qualityCheckMode`
- original item image
- generated package image
- package goal

Behavior:

- `none`: skip.
- `basic`: local file/image checks only.
- `smart`: multimodal LLM quality check.

Outputs:

- `package.qcResult`

### 10. Collect Item Artifacts

Canonical node:

- `aggregator` or `data`

Purpose:

- Collect all artifacts and errors for the current item.

Outputs:

- `item.result`

### 11. Aggregate Batch Results

Canonical node:

- `aggregator`

Purpose:

- Count completed items, failed items, generated images, skipped packages, and retryable failures.

Outputs:

- `factory.results`

### 12. Preview Manifest

Canonical node:

- `data` or image-generation `llm` node output metadata

Purpose:

- Build the ordered thumbnail/result manifest that the PC conversation renders.
- Keep `remoteUrl`, `thumbnailPath`, SKU, package key, package label, status, and error metadata.
- Do not download, proxy, upload, or store generated image bytes on the server.

Default artifact:

- `factoryPreview.kind = digital_factory_image_batch`
- `factoryPreview.items[]`

Optional later export:

- The PC may add a separate "cache selected images locally" action.
- ZIP export can be enabled only after generated images have local cache paths.

Legacy local folder example, only after local cache exists:

```text
跨境商品图工厂_20260730_任务名/
  SKU001/
    SKU001_white.png
    SKU001_main.png
    SKU001_scene_01.png
  SKU002/
    SKU002_background_01.png
    SKU002_model_01.png
```

Outputs:

- `factory.previewItems`
- `factory.remoteUrlManifest`

### 13. Factory Output

Canonical node:

- `output`

PC message should show:

- Batch completed count.
- Generated image count.
- Failed/skipped package count.
- Ordered thumbnails, click-to-enlarge preview, remote URL copy, and retry failed items.

Detailed node input/output traces stay in the PC log panel, not the main user conversation.

## Model Capability Requirements

All model calls are customer-configured.

Factory V1 needs:

1. Vision-capable LLM:
   - Used by `generate_package_instructions`.
   - Input: image + text.
   - Output: JSON.
2. Image editing/generation model:
   - Used by package generation nodes.
   - Input: image + prompt.
   - Output: upstream image URL metadata (`remoteUrl`/`thumbnailPath`), optionally followed by PC local cache metadata.
   - Stored as `llm.config.llmTaskType = image_generation`.
   - Editing behavior is selected by model capabilities and inputs such as `image_generation`, `image_to_image`, or `image_editing`; it is not a separate canonical node type.
3. Optional smart QC multimodal model:
   - Can reuse the vision-capable LLM.
   - Only required if user chooses `smart` quality check.

The PC app must show readiness before running:

```text
文本/视觉模型：已配置 / 未配置
图片生成/编辑模型：已配置 / 未配置
智能质检模型：仅智能质检时需要
本地产物缓存：可用 / 不可用
本地缓存/ZIP 导出：可选，仅在 PC 已缓存生成图片后启用
```

Missing configuration must fail before generation starts, with a direct link to model configuration.

## Admin-Console Requirements

### Navigation

Digital factory should be visible as a first-class concept next to digital employee:

- 数字员工
- 数字工厂
- 工作画布
- 资产中心

The existing work canvas should support both application types.

### Create Flow

Admin can choose:

- 创建数字员工
- 创建数字工厂

For factories, the form includes:

- Factory name.
- Industry/category.
- Summary.
- Factory kind.
- Batch input rules.
- Product package definitions.
- Supported platform presets.
- Required model capabilities.
- Required local tools.
- Output/cache policy.
- Permission/visibility rules.

### Canvas UX

The canvas remains compact:

- Visible nodes use Chinese business names.
- Underlying stored node types remain canonical.
- `LLM 大模型` node includes task type selection such as `vision`, `image_generation`, `text`.
- `数据处理` node includes `dataMode`.
- `产物生成` node can still support `png`, `jpg`, and `zip`, but the default image factory output is URL preview metadata.

Factory-specific UI helpers:

- Factory variable picker group.
- Product package branch generator.
- Platform preset selector.
- Quality check mode selector.
- Batch size warning.

### Publish Validation

Factory templates must validate:

- `applicationType = digital_factory`.
- `factory.batch.maxItems <= 50`.
- At least one selectable package exists.
- Every package key used by conditions is defined in the manifest.
- Required model capabilities are declared.
- Image package nodes output URL metadata with optional local cache paths.
- ZIP artifact node is optional and only valid after a local cache step exists.
- Dimension package declares missing-dimension behavior.
- Smart QC is optional and cannot be a hard requirement unless the template explicitly says so.

## PC-App Requirements

### Catalog And Installation

PC catalog must show application type:

- Digital employees in the current employee list.
- Digital factories in a factory list or factory tab.

Factory install card should show:

- What files can be uploaded.
- Batch limit.
- Supported packages.
- Output file types.
- Required model capabilities.

### Factory Operation Panel

Running a factory should not use the normal chat-only input as the main UI.

Required UI:

- Upload product images.
- Optional SKU table upload.
- Platform selector.
- Product package checkboxes.
- Quality check mode selector.
- Quantity per package: 1/2/3.
- Retry count: 0/1/2.
- Output format and aspect ratio.
- User instruction / advanced prompt supplement.
- Readiness checklist.
- Start production button.

### Batch Progress

Show a compact table:

- Item/SKU.
- Selected packages.
- Status.
- Generated count.
- Failed/skipped count.
- Actions: preview, retry item, open folder.

The main conversation should show only high-level progress. Full node inputs/outputs remain in logs.

### Image Result Metadata And Optional Local Cache

Generated images are first represented as URL metadata.

Rules:

- Store `remoteUrl`, `thumbnailPath`, SKU, package key, package label, status, and error metadata.
- Keep generated image bytes out of the QiuAI server.
- PC can show ordered thumbnails directly from URL metadata.
- PC may cache or save selected images locally under the existing workspace artifact cache.
- Keep 30-day cleanup for local caches.
- ZIP export is available only after URLs have been cached locally.

## Server/API Requirements

The server remains the control plane.

### Template APIs

Existing role template APIs can be extended additively:

- List supports `applicationType` filter.
- Create/update accepts `applicationType`.
- Desktop template response includes `applicationType` and `factoryManifest` metadata.

Example:

```ts
interface AdminTemplateSummary {
  id: string;
  version: string;
  name: string;
  applicationType: 'digital_employee' | 'digital_factory';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
  workflowGraph: ServerRoleWorkflowGraph;
  dependencyManifest: Record<string, unknown>;
}
```

### Error Semantics

Use existing structured errors:

- `VALIDATION_ERROR`: invalid factory manifest, batch limit, package definitions.
- `NOT_FOUND`: template not found.
- `FORBIDDEN`: workspace cannot access the template.
- `CONFLICT`: duplicate IDs or invalid publication state.
- `INTERNAL_ERROR`: unexpected server error.

### Persistence

Preferred Prisma addition:

```prisma
enum RoleTemplateApplicationType {
  DIGITAL_EMPLOYEE
  DIGITAL_FACTORY
}

model RoleTemplate {
  applicationType RoleTemplateApplicationType @default(DIGITAL_EMPLOYEE) @map("application_type")
}
```

If a separate enum migration is too heavy, a string field with validation at service boundary is acceptable. Existing records must default to digital employee.

No new task table is required for Factory V1 unless PC-side local task history cannot represent factory batch progress cleanly. Prefer extending local PC runtime state first.

## Code Style

Use typed boundaries and compact discriminated unions.

Good:

```ts
type QiuApplicationType = 'digital_employee' | 'digital_factory';

type FactoryQualityCheckMode = 'none' | 'basic' | 'smart';

interface FactoryPackageDefinition {
  key: FactoryImagePackageKey;
  name: string;
  description: string;
  outputArtifactType: 'png' | 'jpg';
  requiresDimensions?: boolean;
  allowsTextOverlay?: boolean;
}

function isDigitalFactoryTemplate(template: {
  applicationType?: string;
  dependencyManifest?: unknown;
}): boolean {
  return template.applicationType === 'digital_factory';
}
```

Rules:

- Use `applicationType`, not ambiguous names like `type`, for employee/factory distinction.
- Use `factoryManifest` or `dependencyManifest.factory`, not scattered config keys.
- Use `FactoryImagePackageKey` for package IDs.
- Use local asset refs for images.
- Do not put model API keys in server templates.
- Do not encode billing concepts into Factory V1.

## Testing Strategy

### Unit Tests

Server:

- Normalize and validate `applicationType`.
- Validate factory manifest.
- Reject factory batch size greater than 50.
- Reject unknown package keys in selected package conditions.
- Ensure existing digital employee templates default to `digital_employee`.

Admin-console:

- Factory create form saves application type.
- Package checkbox config serializes to manifest.
- Factory canvas variable picker shows reserved factory variables.
- Publish validation warnings are readable.

PC app:

- Factory readiness detects missing vision/image model capabilities.
- Batch input rejects more than 50 items.
- Selected package checkboxes produce `factory.selectedPackages`.
- Basic QC does not invoke model calls.
- Smart QC requires a configured multimodal model.
- Result preview shows ordered thumbnail URL metadata without uploading images to the server.

### Integration Tests

- Admin creates a digital factory draft.
- Admin publishes the factory.
- Desktop catalog receives the factory with `applicationType = digital_factory`.
- PC installs the factory and renders factory UI instead of chat-only UI.
- PC runs a 2-item batch in mocked model mode and produces ordered remote URL preview items.
- Existing digital employee install/run tests still pass.

### Manual Acceptance

Test case 1:

- Upload 2 product images.
- Platform: Amazon.
- Packages: white background + main image.
- QC: basic.
- Expected: ordered thumbnail result grid with 4 remote URL items; no generated image bytes are sent to the server.

Test case 2:

- Upload 1 product image with dimensions in SKU table.
- Packages: dimension image + selling-point image.
- QC: smart.
- Expected: dimension image does not invent missing dimensions; smart QC trace is visible in logs.

Test case 3:

- Upload 3 product images.
- Platform: TikTok Shop.
- Packages: scene image + model replacement.
- Expected: model/image configuration is checked before run; failed items can be retried.

Regression:

- Existing AI 文档整理专员 still installs and produces docx.
- Existing AI 表格整理专员 still installs and produces xlsx.
- Existing PC chat artifact cards still work.

## Implementation Plan

### Phase 1: Contract And Persistence

- Add `applicationType` contract.
- Add Prisma field with default `DIGITAL_EMPLOYEE`.
- Extend server DTOs and template serializers.
- Keep existing templates defaulting to digital employee.

Acceptance:

- Existing admin and PC template lists still work.
- Server tests prove default employee behavior is unchanged.

### Phase 2: Factory Manifest Validation

- Define `QiuFactoryManifest`.
- Add server-side factory manifest validation.
- Add cross-border image factory package/platform constants.
- Add publish validation for factory templates.

Acceptance:

- Invalid batch size or unknown package key blocks publish.
- Valid factory draft passes validation.

### Phase 3: Admin Factory Authoring

- Add digital factory navigation/listing.
- Add create factory entry.
- Add factory settings panel.
- Add package/platform/QC/batch configuration UI.
- Add factory variable picker group.

Acceptance:

- Operator can create and save a factory draft without touching JSON manually.

### Phase 4: Cross-Border Image Factory Template

- Create the first high-quality factory template.
- Build the 7-package workflow graph using canonical nodes.
- Include reserved variables, selected package routing, optional QC, and URL preview output.

Acceptance:

- Template appears in admin digital factory list.
- Publish validation passes.

### Phase 5: PC Catalog And Install

- Show factories separately from digital employees or in a clear tab.
- Factory install card shows upload types, package list, output types, and required models.
- Installed factory is rendered as a factory operation panel.

Acceptance:

- PC user can install factory and understand required setup before running.

### Phase 6: PC Factory Runtime

- Add factory batch input handling.
- Enforce 50-item cap.
- Populate factory variables.
- Run the existing workflow graph through iteration/condition branches.
- Save generated image URL metadata and optional local cache paths.

Acceptance:

- A small mocked batch produces expected URL preview artifacts and task logs.

### Phase 7: Factory Results UX

- Add batch progress table.
- Add ordered thumbnail preview, click-to-enlarge, and remote URL copy/save follow-up actions.
- Add retry failed item/package action.
- Keep verbose node traces in logs.

Acceptance:

- User can see batch status without reading raw node input/output tables.

### Phase 8: Validation And Regression

- Run server/admin/PC typechecks and focused tests.
- Verify existing digital employees are not broken.
- Verify factory install/run path.

Acceptance:

- Factory V1 works end to end in mocked model mode.
- Existing document/table digital employee flows still work.

## Implementation Risks And Gaps

Current system fit:

- `workflowGraph` already supports `llm`, `iteration`, `condition`, `artifact`, `png`, `jpg`, and `zip` at the contract level.
- Admin canvas already has an `image_generation` LLM task concept and model assets with image generation/editing capabilities.
- PC runtime already recognizes image file extensions as image artifacts.

Known gaps to close during implementation:

- Confirm or add optional PC-side remote image caching for generated `png` and `jpg` URLs.
- Confirm or add ZIP export only after generated URLs have been cached locally.
- Ensure image-generation LLM results can be converted into preview URL metadata, not just text responses.
- Ensure batch execution uses item/package status rather than flooding the normal conversation with raw node input/output tables.
- Ensure model readiness checks distinguish vision JSON generation, image generation/image-to-image, and optional smart QC.

## Boundaries

Always:

- Keep `workflowGraph` as the only canonical graph protocol.
- Use `llm` node for all model capabilities.
- Keep all model credentials customer-controlled in PC configuration.
- Keep images and generated artifacts local by default.
- Enforce 50 product items per batch.
- Make quality check optional.
- Preserve existing digital employee behavior.
- Use new factory definitions when old meanings conflict in factory templates.

Ask first:

- Adding AI points or payment back into the design.
- Storing generated images on the server.
- Proxying customer model calls through the server.
- Bundling an external image editor/runtime dependency.
- Increasing batch limit above 50.

Never:

- Build a separate factory workflow DSL.
- Store customer model API keys in server templates.
- Upload large product images to the server by default.
- Force all 7 product packages to generate when the user selected only some.
- Let AI invent dimensions, certifications, brand logos, or unsupported claims.
- Hide missing model/tool configuration until after a batch has started.

## Success Criteria

Factory V1 is done when:

1. Admin-console can create and publish a `digital_factory` template.
2. The cross-border product image factory contains all 7 selectable packages.
3. PC-app shows a factory operation panel instead of only chat input.
4. PC-app accepts up to 50 product items per batch and blocks larger batches.
5. PC-app checks required model capabilities before execution.
6. User-selected packages drive branch execution.
7. Quality check can be `none`, `basic`, or `smart`.
8. Generated image artifacts are saved locally.
9. Ordered thumbnail preview works from remote URL metadata; ZIP remains an optional local-cache export.
10. Existing digital employee flows continue to pass regression tests.

## Open Questions

These can be answered during implementation, but they should not change the core direction:

1. Should the PC factory list be a separate sidebar entry or a tab under digital employees?
2. Should the first factory template be seeded automatically on server startup or only created through an admin seed script?
3. Which specific model asset keys should be recommended first for vision and image editing?
4. Should selling-point image text overlay use image model text first, or prioritize deterministic local composition from the first version?
5. Should dimension image use image model generation in V1, or should deterministic local composition be included immediately?
