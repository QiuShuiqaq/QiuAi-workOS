# QiuAI WorkOS 系统架构

## 架构目标

QiuAI WorkOS 是面向企业数字劳动力的运行平台。架构设计必须支撑：

- 个人版免费使用与企业版商业订阅
- 多租户企业组织管理
- 以岗位为中心的产品抽象
- 行业岗位模板的安装、配置和复用
- 多 Agent、Workflow、Tool、模型和知识库的协同执行
- 权限、审批、日志、审计和成本治理
- 任务执行过程的可观测、可追踪和可优化

## 总体分层

```text
┌──────────────────────────────────────────────┐
│ Experience Layer                              │
│ 个人工作台 / 企业控制台 / PC端 / 移动端          │
├──────────────────────────────────────────────┤
│ Commercial & Entitlement Layer                │
│ 套餐 / 订阅 / 权益 / 配额 / 用量 / 计费          │
├──────────────────────────────────────────────┤
│ Enterprise Management Layer                   │
│ 租户 / 组织 / 部门 / 用户 / 权限 / 审批 / 审计  │
├──────────────────────────────────────────────┤
│ Role Operating Layer                          │
│ 岗位模板 / 岗位实例 / 岗位配置 / KPI / 成本     │
├──────────────────────────────────────────────┤
│ Execution Layer                               │
│ 任务调度 / Workflow / Agent 协作 / 人工确认     │
├──────────────────────────────────────────────┤
│ Capability Layer                              │
│ 模型网关 / 工具连接器 / MCP / 知识库 / Memory   │
├──────────────────────────────────────────────┤
│ Infrastructure Layer                          │
│ 数据库 / 队列 / 对象存储 / 缓存 / 日志 / 监控    │
└──────────────────────────────────────────────┘
```

## 核心模块

### 1. 账号空间与商业权益模块

负责个人版、企业版和收费能力边界：

- Account：全局账号身份
- Workspace：用户可见工作空间，分为个人空间和企业空间
- Plan：套餐定义
- Subscription：订阅记录，支持月度和年度
- Entitlement：功能权益
- QuotaPolicy：配额策略
- UsageMeter：用量计量
- BillingAccount：账单主体

该模块必须是后端强约束。前端可以根据权益隐藏或提示功能，但不能作为真正的权限和收费判断来源。

### 2. 企业与组织模块

负责企业级基础能力：

- Tenant：租户隔离
- Organization：企业主体
- Department：部门结构
- User：企业成员
- TeamRole：人类成员在系统中的权限角色
- AuditLog：审计日志

该模块为岗位运行提供组织边界、权限边界和审计基础。

个人版不暴露 Organization 和 Department 概念；企业版以 Organization 为核心，并支持 Department、成员、权限、审批和审计。

### 3. 岗位操作系统模块

负责 Role 相关能力：

- RoleTemplate：行业岗位模板
- RoleInstance：企业内安装后的岗位实例
- RoleConfig：岗位配置
- RolePermission：岗位可访问的数据、工具和系统
- RoleKPI：岗位绩效指标
- RoleCostPolicy：岗位成本策略

普通企业用户主要与这一层交互。

### 4. 任务中心模块

负责把岗位工作转化为可追踪的任务：

- Task：业务任务
- Job：底层执行单元
- TaskStatus：任务状态
- Artifact：任务产物
- Review：人工审核记录
- Report：日报、周报或专项报告

任务中心是企业理解 AI 岗位工作状态的核心界面。

### 5. 执行编排模块

负责底层 AI 执行：

- WorkflowDefinition：流程定义
- WorkflowRun：流程运行记录
- AgentDefinition：Agent 定义
- AgentRun：Agent 运行记录
- HumanApproval：人工审批节点
- Scheduler：定时任务
- RetryPolicy：失败重试策略

这一层可以集成第三方 Workflow Engine 或 Agent Framework，但对上层保持统一的岗位执行接口。

### 6. 能力连接模块

负责连接模型、知识和工具：

- ModelGateway：统一模型网关
- ModelConfig：模型配置
- ToolConnector：业务系统连接器
- MCPServer：MCP 工具接入
- KnowledgeBase：知识库
- MemoryStore：岗位记忆
- FileAsset：文件和素材资产

模型和工具都是可替换基础设施，不应该污染岗位层的业务抽象。

### 7. 观测与治理模块

负责企业级运行治理：

- ExecutionLog：执行日志
- CostRecord：成本记录
- QualityMetric：质量指标
- Alert：异常告警
- AuditEvent：审计事件
- Dashboard：运行看板

企业需要知道 AI 岗位做了什么、花了多少钱、质量如何、风险在哪里。

## 版本形态约束

### 个人版

个人版是免费入口，面向个人用户和小规模试用。系统为每个用户创建个人工作空间，允许搭建少量 AI 员工，但不提供企业部门、多人组织、企业级权限、审批、审计和高级成本治理。

### 企业版

企业版是收费入口，面向企业组织。企业版必须以 Organization 为核心，并支持 Department、成员、岗位归属、企业知识、工具连接、审批、审计、成本预算和绩效看板。

### 多端一致性

Web、PC 和移动端必须通过同一组 API 契约读取 Workspace、Plan、Entitlement 和业务数据。套餐权益判断不能在各端重复实现。

## 关键运行流程

### 安装岗位

```text
企业管理员选择岗位模板
填写企业配置
绑定部门和负责人
授权知识库和工具
配置审批规则
生成岗位实例
进入试运行
```

### 执行任务

```text
触发任务
创建 Task
拆解 Job
调用 Workflow
调度 Agent
读取知识和工具
生成 Artifact
进入人工审批或自动完成
记录成本、日志和指标
更新岗位绩效
```

### 沉淀模板

```text
客户项目交付
抽象通用流程
移除客户私有数据
封装默认配置
定义适用行业和前置条件
发布为 RoleTemplate
进入 Marketplace
```

## 设计原则

### Role 是上层稳定接口

底层模型、Agent Framework 和 Workflow Engine 可以替换，但 Role 的业务语义必须稳定。

### 先企业治理，再 AI 魔法

企业级产品不能只有执行能力。权限、审批、审计、成本和监控是默认能力，不是后期补丁。

### 模板资产可迁移

岗位模板必须能从单个客户项目中抽象出来，并迁移到同类客户。

### 执行过程可解释

每个任务都要能回答：

- 谁触发了任务？
- 哪个岗位执行？
- 调用了哪些模型和工具？
- 消耗多少成本？
- 生成了哪些结果？
- 是否经过人工审批？
- 失败原因是什么？

### 高级能力分层暴露

普通企业用户只看到岗位、任务、结果和绩效。实施人员和开发者可以进入高级模式，配置 Workflow、Prompt、Agent、Tool、MCP、Memory 和审批。

### 套餐权益是系统契约

个人版和企业版差异不能只体现在前端菜单。所有创建岗位、添加成员、创建部门、启用审批、连接工具、超额执行任务等操作都必须通过 Entitlement 和 QuotaPolicy 检查。

## 暂不绑定的技术选择

当前文档定义产品架构和系统边界，不绑定具体技术栈。以下选择应在实现阶段通过 ADR 记录：

- Web 框架
- 数据库
- Workflow Engine
- Agent Framework
- 向量数据库
- 队列系统
- 对象存储
- 部署平台
- 模型供应商
