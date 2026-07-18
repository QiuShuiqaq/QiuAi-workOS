# QiuAI WorkOS 第一版交付计划

## 交付目标

第一版要做到本地可运行、界面完整、接口统一、逻辑闭环。

本地不依赖 PostgreSQL。Prisma schema 保留为服务器部署和数据库落地准备；当前开发阶段后端使用 mock repository/seed data。

## 成功标准

- Web 控制台有完整第一版导航和主要页面。
- 前端所有业务数据通过 `@qiuai/api-client` 调统一后端 API。
- 后端所有接口使用 `/api/v1` 路径和统一错误结构。
- 可完成 `Workspace -> AI岗位 -> 任务创建 -> Mock执行 -> 产物/日志/成本展示` 闭环。
- Personal Free 和 Enterprise 的套餐/权益概念在界面和接口中可见。
- 本地验证命令通过：
  - `.\tools\npm-local.cmd run typecheck`
  - `.\tools\npm-local.cmd run build`
  - 后端 API smoke test
  - 前端页面 HTML smoke test

## 第一版页面范围

- 工作台 `/`
- AI 岗位 `/roles`
- 岗位详情 `/roles/[roleId]`
- 任务中心 `/tasks`
- 任务详情 `/tasks/[taskId]`
- 审批中心 `/approvals`
- 成本中心 `/costs`
- 企业设置 `/settings`

## 第一版 API 范围

- `GET /api/v1/health`
- `GET /api/v1/kernel/status`
- `GET /api/v1/workspaces/current`
- `GET /api/v1/workspaces/:workspaceId/overview`
- `GET /api/v1/commercial/plans`
- `GET /api/v1/workspaces/:workspaceId/roles/templates`
- `GET /api/v1/workspaces/:workspaceId/roles`
- `GET /api/v1/workspaces/:workspaceId/roles/:roleId`
- `POST /api/v1/workspaces/:workspaceId/roles/install`
- `GET /api/v1/workspaces/:workspaceId/tasks`
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId`
- `POST /api/v1/workspaces/:workspaceId/tasks`
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/run`

## 闭环定义

第一版闭环不是接真实模型，而是用 mock execution runtime 验证产品结构：

```text
选择企业 Workspace
查看 AI 岗位
安装或选择岗位
创建任务
触发 Mock 执行
生成 Artifact
生成 ExecutionLog
生成 CostRecord
在任务详情页查看结果
```

## 暂不纳入第一版

- 真实登录注册
- 本地 PostgreSQL 强依赖
- 真实支付
- 真实 Dify/LangGraph 集成
- Electron 打包
- React Native 移动端实现
- Marketplace 完整交易

这些能力保留接口和架构位置，但不阻塞第一版本地交付。
