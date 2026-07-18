# QiuAI WorkOS 项目框架

## 总体原则

QiuAI WorkOS 采用 Monorepo，后端先采用模块化单体，前端采用多端共享契约和共享组件体系。

核心约束：

- 先稳定平台内核，再扩展岗位模板和 AI 执行能力。
- 服务端是权限、套餐和用量判断的唯一可信来源。
- Web、PC、移动端共用领域类型和 API 契约。
- 个人版和企业版共用同一套业务内核。
- 业务模块按领域边界组织，不按页面或 CRUD 表组织。

## 根目录

```text
apps/                 # 多端应用
packages/             # 多端共享包
services/             # 可独立运行的后台 worker
infra/                # 部署和本地基础设施
docs/                 # 产品、架构、领域和开发文档
tools/                # 项目本地脚本
.local/               # 项目本地缓存和工具输出，不提交 Git
```

## 应用层

```text
apps/server           # 主 API 服务
apps/web-console      # Web 控制台
apps/pc-app           # Electron PC 端
apps/mobile-app       # React Native / Expo 移动端
apps/admin-console    # 平台运营后台，后置
```

早期开发优先级：

```text
server
web-console
packages/domain
packages/api-contract
packages/ui
```

## 共享包

```text
packages/domain           # 领域类型、枚举、状态
packages/api-contract     # API 错误、分页、请求响应契约
packages/api-client       # Web/PC/Mobile 共用 API Client
packages/design-tokens    # 设计 token
packages/ui               # QiuAI 业务组件
packages/config           # 共享配置
packages/utils            # 通用工具
```

业务页面应优先使用 `@qiuai/ui` 的业务组件，再由业务组件封装 Ant Design。

当前阶段共享包采用 source-first 工作方式，由 Next.js 通过 `transpilePackages` 消费源码。等需要对外发布 SDK 或独立包时，再引入 TypeScript project references 和独立 dist 发布流程。

## 服务端模块

```text
apps/server/src/modules/
  identity/
  workspace/
  commercial/
  organization/
  iam/
  role/
  task/
  execution/
  knowledge/
  tool/
  model/
  governance/
  marketplace/
```

每个模块内部保持统一边界：

```text
domain/
application/
infrastructure/
interface/
```

## 多端关系

```text
server
  ↓ API contract
packages/api-contract
  ↓ generated/shared client
packages/api-client
  ↓
web-console / pc-app / mobile-app
```

`api-client` 会在后续阶段创建。当前先稳定 `domain` 和 `api-contract`。
