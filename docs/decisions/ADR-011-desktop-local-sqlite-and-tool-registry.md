# ADR-011: Desktop local state uses embedded SQLite and a manifest-driven tool registry

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS 的桌面端是企业数字员工的主工作台。用户安装在自己的 Windows 电脑上后，不应该再手工安装数据库、配置数据库连接，或者把本地结构化状态散落在多个 JSON 文件里。

同时，桌面端要借鉴 Dify 一类产品的能力组织方式，但不能把产品 shell 做成 workflow-first。我们需要一个统一、可枚举、可校验、可同步的工具/模型/岗位注册体系，方便后续接入文档处理、网页搜索、Office 操作、浏览器自动化等能力。

本地还必须继续保留文件系统目录来承载大文件、索引、日志、缓存、备份和生成物。服务端只存控制面和摘要。

## Decision
Use workspace-scoped embedded SQLite for structured desktop state, implemented with `sql.js` for portable Windows/Electron packaging, and use a manifest-driven tool registry as the canonical capability layer.

具体规则：

- 每个 workspace 对应一个独立本地目录
- 结构化状态进入 SQLite
- 大文件、索引、日志、缓存、备份继续留在文件系统
- 工具定义、工具能力、工具适用范围、启用状态、审批要求都通过注册表管理
- 桌面端主进程负责数据库启动、迁移和读写
- 渲染进程只通过 IPC 读取受控数据
- 服务端继续只接收摘要、元数据、审计和同步状态

建议的本地数据库文件位置：

```text
apps/pc-app userData/
  workspaces/<workspaceId>/db/workbench.sqlite
```

## Alternatives Considered

### JSON files only
- Pros: simplest to start
- Cons: 状态会继续膨胀，迁移和查询都会越来越乱
- Rejected: 不适合企业桌面端长期演进

### 用户手工安装 PostgreSQL / MySQL
- Pros: 结构化能力强
- Cons: 用户不可接受，部署和支持成本过高
- Rejected: 违背桌面端零配置目标

### 服务端集中存储本地运行状态
- Pros: 实现直观
- Cons: 服务器压力大，和本地优先策略冲突
- Rejected: 不符合当前商业和硬件约束

### 把 Dify 作为产品 shell
- Pros: 能快速拿到一些能力层
- Cons: 产品语言会变成 workflow-first，不利于岗位优先
- Rejected: Dify 只作为能力参考，不作为外壳

## Consequences
- SQLite runtime uses WASM, so packaging must include `sql-wasm.wasm`.
- 首次安装后可以自动完成本地运行时初始化
- 桌面端能稳定保存岗位、工具、任务和同步元数据
- 迁移逻辑可以逐步把旧 JSON 状态收敛进数据库
- 以后扩展工具、模板、审计和本地执行能力时，不用再改存储骨架
- 需要为 Electron 的本地 SQLite 原生依赖、迁移和打包做专门测试
