# Spec: AI制作视频工厂

## Objective

把“原始录屏/视频素材”做成一个稳定、可控的 AI 内容生产工厂。

本功能不是通用 Agent，也不是纯视频剪辑工具。它的第一版目标是：

1. 用户上传一份源视频。
2. 系统先做 ASR 转写，再按时间轴分析内容结构。
3. 用户只选择一个平台：`B站` 或 `抖音`，一次任务只产出一个平台结果。
4. 系统生成可审核、可修改的内容结构。
5. 系统最终只导出一个主产物：`mp4`。

关键边界：

- 不做 B站 和抖音同时产出。
- 不做自动发布。
- 不做图像理解/视频理解作为主分析手段，只走 `ASR -> 文本分析`。
- 不把封面、片头、片尾、水印做成模型生成的强依赖，优先做成可复用资产。
- 不重做一套新的工作流协议，优先复用现有 `workflowGraph`、任务系统、产物系统和 `video-processing` 工具链。

## Assumptions

1. 这是现有 `QiuAi-workOS` 的新增数字工厂模板，不是独立产品。
2. 新模板必须使用新的 `templateId` / `roleCode`，不复用旧模板标识。
3. 现有 `Task` / `TaskRun` / `TaskArtifact` / `ExecutionLog` / `CostRecord` 继续复用。
4. 源视频在 PC 端本地处理，服务端只保存必要元数据和任务状态。
5. 大文件不进数据库，视频分析依赖本地 `ffmpeg` 和现有视频工具。
6. UI 里只展示内部线路名和能力槽位，不直接暴露供应商名称。

## Tech Stack

- Server: NestJS + Prisma + PostgreSQL
- Admin: Next.js + React + Ant Design
- PC: Electron + React + TypeScript + FFmpeg
- Shared contracts: `packages/api-contract`
- Existing media tools: `video.probe`, `video.extract_audio`, `video.compose_clips`, `video.export_mp4`
- Existing ASR route: `qiu-asr-default`
- Existing text-to-audio capability: `text_to_audio`

## Commands

Development:

```powershell
npm run dev:server
npm run dev:admin
npm run dev:pc
```

Validation:

```powershell
npm run db:generate
npm run typecheck -w @qiuai/server
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/server
npm run test -w @qiuai/pc-app
```

Build:

```powershell
npm run build -w @qiuai/server
npm run build -w @qiuai/admin-console
npm run build -w @qiuai/pc-app
```

Desktop packaging:

```powershell
npm run package:installer -w @qiuai/pc-app
```

## Project Structure

Expected ownership:

```text
apps/server/
  prisma/schema.prisma
  src/shared/role-template-catalog.ts
  src/shared/workflow-graph.ts
  src/shared/tool-action-catalog.ts
  src/modules/role-template-factory/
  src/modules/task/
  src/modules/asset-center/

apps/admin-console/
  src/features/templates/
  src/features/assets/
  src/features/plans/

apps/pc-app/
  src/shared/desktop-task-runner.ts
  src/shared/desktop-model-capabilities.ts
  src/shared/desktop-contract.ts
  src/main/model-chat.ts
  src/main/desktop-tool.ts
  src/renderer/App.tsx

packages/api-contract/
  src/workflow-graph.ts
  src/tool-action-registry.ts
  src/asset-center.ts
```

## Product Model

### Template Identity

New factory template:

- `templateId`: `factory_ai_video_production_v1`
- `roleCode`: `ai-factory-ai-video-production-v1`
- `applicationType`: `DIGITAL_FACTORY`

It is a new template, not a rename of any existing video factory.

### Task Mode

One task has exactly one platform:

- `bilibili`
- `douyin`

The platform drives default ratio, duration presets, copy style, and render behavior.

### Output Model

One task produces one main deliverable:

- `mp4`

Review data may also be stored as structured JSON, but it is not the primary export.

### Voice Presets

The factory exposes 8 semantic voice presets:

```ts
type VideoVoicePresetKey =
  | 'male_pro_1'
  | 'male_pro_2'
  | 'male_pro_3'
  | 'male_pro_4'
  | 'female_pro_1'
  | 'female_pro_2'
  | 'funny_1'
  | 'funny_2';
```

Suggested UI labels:

- 专业男 - 沉稳讲解
- 专业男 - 清晰播报
- 专业男 - 科技旁白
- 专业男 - 亲和口播
- 专业女 - 清亮讲解
- 专业女 - 柔和播报
- 搞怪 - 夸张解说
- 搞怪 - 活泼吐槽

UI only shows these semantic labels. Actual provider mapping stays in model configuration.

### Reusable Assets

Four asset kinds are part of the factory, not part of the source video:

- `intro`: `mp4`
- `outro`: `mp4`
- `cover`: `png`
- `watermark`: transparent `png`

Watermark can also have a deterministic local fallback generator.

Uploaded assets are numbered automatically in the UI:

- `片头1`
- `片头2`
- `片尾1`
- `封面1`
- `水印1`

## Data Model

### Keep Existing Tables

Reuse:

- `Task`
- `TaskRun`
- `TaskArtifact`
- `ExecutionLog`
- `CostRecord`

Do not create a separate generic agent table.

### New Table

Add one lightweight reusable asset table only:

`FactoryMediaAsset`

Suggested fields:

- `id`
- `workspaceId`
- `roleTemplateId`
- `kind` (`intro` | `outro` | `cover` | `watermark`)
- `fileName`
- `originalFileName`
- `mimeType`
- `fileSizeBytes`
- `checksumSha256`
- `storagePath`
- `width`
- `height`
- `durationSeconds`
- `sortOrder`
- `status`
- `createdAt`
- `updatedAt`

Notes:

- Source videos stay on the PC side.
- Small reusable assets may be stored in existing server file storage.
- Review JSON can be serialized into `TaskArtifact.content` for v1.
- No new artifact type is required for v1 unless editing experience proves it necessary.

## API Surface

### Server

Reused or extended APIs:

- list digital factory templates
- create task for `factory_ai_video_production_v1`
- poll task status and artifacts
- save task review data
- render final mp4

New factory asset APIs:

- upload reusable factory media asset
- list reusable factory media assets by `roleTemplateId` and `kind`
- delete or disable reusable factory media asset

### Desktop / PC

PC task payload should include:

- source video path
- selected platform
- render ratio
- target duration
- resolution
- selected voice preset
- selected intro/outro/cover/watermark asset ids

## Workflow / State Machine

Recommended flow:

1. `source_uploaded`
2. `video_probed`
3. `audio_extracted`
4. `asr_completed`
5. `timeline_analyzed`
6. `platform_content_generated`
7. `user_reviewing`
8. `render_ready`
9. `mp4_rendered`
10. `exported`

Failure states:

- `asr_failed`
- `analysis_failed`
- `render_failed`
- `asset_missing`

### Platform Branch

#### B站

- Generate teaching-oriented structure.
- Use chapter-level organization as the main review structure.
- Produce a single final mp4.

#### 抖音

- Generate short-video-oriented hook and highlight structure.
- Use highlight candidates for review.
- Produce a single final mp4.

### Structure Choice

Use chapter-level structure as the main human-facing result.

Reason:

- easier to understand
- easier to edit
- easier to map to a final mp4

Sentence-level timestamps remain internal and are used for subtitles and cut boundaries.

## UI / UX

Single-page factory flow:

- Source video upload
- Platform selector (`B站` / `抖音`)
- Render settings
- Reusable asset pickers
- Voice preset picker
- Timeline / chapter review
- Final mp4 preview and export

Render controls:

- orientation / ratio
- duration
- resolution

Behavior rules:

- one task only one platform
- no auto publish
- no simultaneous B站 + 抖音 generation
- primary output is mp4, not a pile of side files
- do not clutter the chat area with useless summary nodes

## Code Style

Follow the repo's existing TypeScript and JSON-first workflow style:

```ts
export interface VideoFactoryRenderSettings {
  platform: 'bilibili' | 'douyin';
  ratio: '16:9' | '9:16' | '1:1';
  targetDurationSeconds: number;
  resolution: '720p' | '1080p' | '2k';
  voicePresetKey: VideoVoicePresetKey;
  introAssetId?: string;
  outroAssetId?: string;
  coverAssetId?: string;
  watermarkAssetId?: string;
}
```

Rules:

- keep payloads serializable
- prefer explicit enums and union types
- keep provider names out of user-facing labels
- maintain backward-compatible optional fields

## Testing Strategy

Unit tests:

- asset numbering by kind and upload order
- render setting validation
- platform-specific content shape
- voice preset mapping

Integration tests:

- task creation and status progression
- ASR -> analysis -> render flow
- one-platform validation
- asset upload/list/delete flow

Regression tests:

- existing digital employee templates still install and run
- existing digital factory templates still install and run
- existing `video.compose_clips` and `video.export_mp4` behavior remains backward compatible

## Boundaries

- Always:
  - keep B站 and抖音互斥
  - keep one task one main mp4
  - keep source video local-first
  - reuse existing task / artifact / workflow infrastructure
  - preserve old digital employee and digital factory behavior
- Ask first:
  - drop or rename existing video factories
  - change billing or plan catalog for this feature
  - introduce a brand-new workflow DSL
  - add more than one new persistent table
- Never:
  - auto publish to social platforms
  - depend on image/video understanding as the primary analysis path
  - expose provider/vendor names in the PC UI
  - store large video binaries in the database
  - break existing task history or installed template compatibility

## Success Criteria

1. `AI制作视频工厂` appears as a new digital factory with a new `templateId` / `roleCode`.
2. A task can only select `B站` or `抖音`, not both.
3. The user can upload and reuse `片头 / 片尾 / 封面 / 水印` assets, and the dropdowns show numbered entries.
4. The factory uses ASR output and timestamps as the source of truth for content analysis.
5. The review UI shows editable chapters or highlight candidates, not just a raw text blob.
6. Final export is a single `mp4` per task.
7. Voice presets are available as 8 semantic labels.
8. Existing digital employee and digital factory flows still pass install, task creation, and output checks.

## Open Questions

1. Should v1 expose subtitle export as a separate optional file, or keep subtitles only as editable review data?
2. If the voice provider is not configured, should the factory hard-fail or fall back to a silent/skip-voice render path?
