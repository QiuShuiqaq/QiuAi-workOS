# 规格：桌面端本地运行时与工具注册表

## 目标
把 `pc-app` 做成企业数字员工的主工作台，重点不是聊天界面，而是一个稳定的本地运行层：

- Windows 桌面端安装后可直接使用，不要求用户手工安装数据库
- 单机只保留一个当前工作区，不做同机多工作区并行
- 结构化状态落本地 SQLite，重资产继续留在本地文件系统
- 服务端继续只做控制面，不承载大文件和本地执行细节
- 工具、模型、岗位、任务都通过统一注册表管理，避免后续重复造轮子

## 已确认前提

- 桌面端只做 Windows
- 不支持离线工作
- 不支持同一台电脑同时登录多个 workspace
- 不主动引入落盘加密，后续按风险再单独规划
- 备份、导出、恢复要支持，但先做架构预留，不浪费资源
- `admin-console` 是平台总后台，`web-console` 是企业控制台，`pc-app` 是企业桌面工作台

## 技术栈

- Electron + TypeScript + React
- 本地嵌入式 SQLite，当前实现采用 `sql.js`
- 共享契约继续沿用 `packages/api-contract`
- 服务端同步继续沿用现有 `desktop-sync` 契约

## 命令

- 桌面开发：`npm run dev:pc`
- 桌面构建：`npm run build -w @qiuai/pc-app`
- 桌面测试：`npm run test -w @qiuai/pc-app`
- 桌面类型检查：`npm run typecheck -w @qiuai/pc-app`
- 全量构建：`npm run build`
- 启动服务端：`npm run dev:server`
- 同步烟雾检查：`npm run check:smoke`
- 部署检查：`npm run check:deploy`

## 项目结构

```text
apps/pc-app/src/
  main/
    storage-layout.ts     # workspace 目录布局
    runtime-store.ts      # 兼容旧 JSON 状态，后续逐步迁移
    local-db/             # SQLite bootstrap / migrations / repositories
    tool-registry/        # 工具清单、能力、权限、适配器注册
    sync/                 # 服务端摘要同步
  preload/                # 安全桥接
  renderer/                # 界面与交互
  shared/                 # 主进程/渲染进程共用类型

docs/
  PC_DESKTOP_LOCAL_RUNTIME_SPEC.md
  decisions/ADR-011-desktop-local-sqlite-and-tool-registry.md
```

## 代码风格

- 所有跨边界数据都用显式 TypeScript 接口
- 注册表优先于散落配置，工具、模型、岗位都要可枚举
- 主进程负责本地数据，渲染进程只读状态和发起请求
- 重资产目录和结构化数据目录分离

示例：

```ts
export interface ToolDefinition {
  id: string;
  name: string;
  scope: 'desktop' | 'server' | 'hybrid';
  entryPoint: 'native' | 'bridge' | 'api' | 'mcp';
  capabilities: Array<'web_search' | 'document_edit' | 'presentation_edit' | 'filesystem'>;
  requiresApproval: boolean;
}

export interface WorkspaceLocalState {
  workspaceId: string;
  activeRoleCode?: string;
  installedRoleCodes: string[];
  enabledToolIds: string[];
  enabledModelProfileIds: string[];
}
```

## 测试策略

- 单元测试：路径布局、workspace 隔离、SQLite 启动、迁移、注册表读写、manifest 校验
- 集成测试：Electron 主进程读取/保存本地状态、重启恢复、与服务端摘要同步
- 兼容测试：旧 JSON 状态能自动迁移到新布局
- 冒烟测试：登录、创建/读取 workspace、本地工具启用、任务状态保存、重启后恢复

目标验证命令：

- `npm run test -w @qiuai/pc-app`
- `npm run typecheck -w @qiuai/pc-app`
- `npm run build -w @qiuai/pc-app`
- `npm run check:smoke`

## 边界

- Always: workspace 目录自动创建、本地数据库自动创建与迁移、文件系统只放大文件与缓存、服务端只收摘要、工具注册表统一管理
- Ask first: 新数据库引擎、落盘加密、同机多 workspace、改同步协议、引入独立后台服务、引入外部数据库
- Never: 要用户手工装数据库、把大文件或原始知识库推到服务端、让普通企业用户直接面对 workflow canvas、在桌面端重复实现支付和总权限判断

## 成功标准

- 首次登录后，桌面端自动生成 workspace 目录和 SQLite 文件
- 结构化运行状态能跨重启恢复
- 工具注册表可以新增、查询、启停
- 文件、日志、索引、备份目录继续由文件系统承载
- 服务端同步仍然只传摘要与元数据
- 单机只保留一个当前 workspace
- Windows 上可完成登录、启动、保存、重启恢复的闭环

## 待确认项

- 首版备份/导出/恢复先做后台能力还是直接做 UI
- Office 操作适配层先走本地 COM、文件生成还是桥接执行
- 何时再补落盘加密
