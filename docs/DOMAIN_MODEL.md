# QiuAI WorkOS 领域模型

## 核心领域语言

QiuAI WorkOS 的领域语言必须围绕企业数字劳动力，而不是围绕底层 AI 技术。

核心概念：

- 用户拥有 Account，并进入个人 Workspace 或企业 Workspace
- 个人版使用 Personal Workspace，免费且能力受限
- 企业版使用 Enterprise Workspace，以 Organization 和 Department 为核心
- 企业安装 RoleTemplate，生成 RoleInstance
- RoleInstance 执行 Task，并产出 Artifact
- Task 可以拆解为 Job，由 Workflow 和 Agent 协作完成
- RoleInstance 受 KnowledgeBase、ToolConnector、Permission、ApprovalPolicy 和 ModelConfig 约束
- 系统通过 Plan、Subscription、Entitlement 和 UsageMeter 控制商业权益
- 系统记录 ExecutionLog、CostRecord、QualityMetric 和 AuditEvent

## 实体关系概览

```text
Tenant
├── Account
├── Workspace
│   ├── PersonalWorkspace
│   │   ├── User
│   │   ├── RoleInstance
│   │   └── Task
│   └── EnterpriseWorkspace
│       └── Organization
│           ├── Department
│           │   ├── User
│           │   └── RoleInstance
│           ├── KnowledgeBase
│           ├── ToolConnector
│           ├── ApprovalPolicy
│           └── Task
├── Subscription
├── Entitlement
└── UsageMeter

Marketplace
└── RoleTemplate
    ├── WorkflowDefinition
    ├── AgentDefinition
    ├── DefaultModelConfig
    ├── RequiredTool
    └── KPISet

RoleInstance
├── RoleConfig
├── RolePermission
├── Schedule
├── Task
├── ExecutionLog
├── CostRecord
└── QualityMetric
```

## 主要实体

### Tenant

系统租户边界和商业隔离边界。所有业务数据必须归属于一个 Tenant。

关键字段：

- id
- name
- tenantType
- status
- createdAt

租户类型：

```text
PERSONAL
ENTERPRISE
PLATFORM
```

### Account

全局登录账号。一个 Account 可以拥有个人工作空间，也可以加入一个或多个企业工作空间。

关键字段：

- id
- primaryEmail
- phone
- status
- createdAt

### Workspace

用户可见的工作空间，是前端和 API 的主要上下文。Workspace 可以是个人空间或企业空间。

关键字段：

- id
- tenantId
- workspaceType
- name
- ownerAccountId
- status
- createdAt

工作空间类型：

```text
PERSONAL
ENTERPRISE
```

### Plan

套餐定义，描述个人版和企业版的商业能力边界。

关键字段：

- id
- code
- name
- billingCycle
- price
- currency
- entitlementSet
- status

基础套餐：

```text
PERSONAL_FREE
ENTERPRISE_MONTHLY
ENTERPRISE_ANNUAL
```

### Subscription

工作空间的订阅记录。

关键字段：

- id
- workspaceId
- planId
- status
- billingCycle
- currentPeriodStart
- currentPeriodEnd
- cancelAtPeriodEnd

订阅状态：

```text
free
trialing
active
past_due
cancelled
expired
```

### Entitlement

套餐权益。系统通过权益判断功能是否可用。

关键字段：

- id
- planId
- featureKey
- limitValue
- limitUnit
- enabled

示例权益：

- maxRoleInstances
- maxTasksPerMonth
- maxKnowledgeBases
- maxStorageGB
- canCreateDepartment
- canInviteMember
- canUseApprovalPolicy
- canUseAuditLog
- canUseAdvancedToolConnector
- canUseCostBudget

### UsageMeter

工作空间的用量计量。

关键字段：

- id
- workspaceId
- metricKey
- period
- usedValue
- resetAt

### Organization

企业主体，承载组织架构、成员、岗位和业务数据。Organization 只存在于企业版 Workspace 中。

关键字段：

- id
- tenantId
- workspaceId
- name
- industry
- size
- settings

### Department

企业部门。AI 岗位和人类员工都可以归属到部门。Department 属于企业版能力，个人版不支持。

关键字段：

- id
- organizationId
- parentDepartmentId
- name
- ownerUserId

### User

系统用户身份。用户可以是个人版使用者、企业成员或平台运营人员。

关键字段：

- id
- tenantId
- accountId
- workspaceId
- organizationId
- name
- email
- status
- systemRole

### RoleTemplate

可复用的行业数字岗位模板，是平台资产。

关键字段：

- id
- name
- industry
- scenario
- description
- version
- requiredKnowledge
- requiredTools
- defaultWorkflowDefinitionId
- defaultAgentDefinitionIds
- defaultKPISet
- status

示例：

- AI案例运营专员
- AI客户回访专员
- AI合同审核专员
- AI售后专员

### RoleInstance

用户或企业安装岗位模板后生成的实际 AI 岗位。个人版允许在个人 Workspace 中创建少量 RoleInstance；企业版 RoleInstance 必须归属于企业 Workspace，并可绑定到 Department。

关键字段：

- id
- workspaceId
- organizationId
- departmentId
- templateId
- name
- ownerUserId
- config
- status
- installedAt

RoleInstance 是企业日常管理的核心对象。

### AgentDefinition

岗位内部的专业执行单元定义。

关键字段：

- id
- roleTemplateId
- name
- responsibility
- promptRef
- modelConfigRef
- toolPermissions

AgentDefinition 是高级配置对象，不直接暴露给普通企业用户。

### WorkflowDefinition

岗位工作流程定义。

关键字段：

- id
- roleTemplateId
- name
- version
- triggerType
- steps
- approvalNodes
- retryPolicy

### Task

企业可感知的业务任务。

关键字段：

- id
- workspaceId
- organizationId
- roleInstanceId
- title
- taskType
- input
- status
- priority
- requesterUserId
- dueAt
- completedAt

任务状态：

```text
draft
queued
running
waiting_approval
completed
failed
cancelled
```

### Job

Task 下的底层执行单元。

关键字段：

- id
- taskId
- workflowRunId
- agentRunId
- status
- input
- output
- error
- startedAt
- finishedAt

### Artifact

任务产物，例如报告、剪辑视频、封面图、标题、合同审查意见或客户回访记录。

关键字段：

- id
- taskId
- type
- title
- contentRef
- metadata
- createdBy
- createdAt

### KnowledgeBase

知识库。个人版绑定到个人 Workspace；企业版可以绑定到组织、部门或岗位。

关键字段：

- id
- workspaceId
- organizationId
- name
- scope
- sourceType
- indexingStatus
- permissionPolicy

### ToolConnector

业务系统或外部工具连接器。高级连接器通常属于企业版能力。

关键字段：

- id
- workspaceId
- organizationId
- name
- provider
- authType
- permissionScope
- status

### ModelConfig

模型配置。用于控制不同岗位、任务或 Agent 使用的模型。

关键字段：

- id
- workspaceId
- organizationId
- provider
- modelName
- temperature
- maxTokens
- costPolicy
- fallbackConfig

### ApprovalPolicy

人工审批规则。

关键字段：

- id
- organizationId
- name
- scope
- condition
- approverUserIds
- timeoutPolicy

### Schedule

定时任务配置。

关键字段：

- id
- roleInstanceId
- cron
- timezone
- taskTemplate
- enabled

### KPISet

岗位绩效指标集合。

关键字段：

- id
- roleTemplateId
- metrics
- evaluationPeriod

示例指标：

- 任务完成数
- 自动完成率
- 人工返工率
- 平均处理时长
- 单任务成本
- 内容发布成功率
- 客户回复满意度

### ExecutionLog

执行日志。

关键字段：

- id
- organizationId
- roleInstanceId
- taskId
- eventType
- message
- payload
- createdAt

### CostRecord

成本记录。

关键字段：

- id
- workspaceId
- organizationId
- roleInstanceId
- taskId
- provider
- modelName
- inputTokens
- outputTokens
- toolCost
- totalCost
- createdAt

### MarketplacePackage

Marketplace 中的岗位模板商品化对象。

关键字段：

- id
- roleTemplateId
- name
- industry
- pricingModel
- installRequirements
- publisher
- status

### BillingAccount

账单主体。个人免费版可以没有独立账单主体；企业版必须有账单主体。

关键字段：

- id
- workspaceId
- billingName
- taxId
- billingEmail
- paymentProvider
- providerCustomerId
- status

## 聚合边界

### Organization Aggregate

管理企业组织、部门、用户和企业设置。

### Commercial Aggregate

管理 Plan、Subscription、Entitlement、UsageMeter 和 BillingAccount。

### Role Aggregate

管理岗位模板、岗位实例、岗位配置、权限、计划任务和 KPI。

### Task Aggregate

管理任务、执行单元、产物、审批和状态流转。

### Capability Aggregate

管理知识库、工具连接器、模型配置和记忆。

### Governance Aggregate

管理审计、成本、质量指标、告警和合规记录。

## 状态流转

### RoleInstance 状态

```text
installing
draft
trial_running
active
paused
archived
```

### Task 状态

```text
draft
queued
running
waiting_approval
completed
failed
cancelled
```

### RoleTemplate 状态

```text
draft
internal
published
deprecated
archived
```

## 领域约束

- 所有业务数据必须有租户边界。
- 所有面向用户的业务数据必须归属于一个 Workspace。
- 个人版 Workspace 不允许创建 Organization 和 Department。
- 企业版 Workspace 必须绑定 Organization，并允许创建 Department。
- RoleInstance 必须归属于一个 Workspace。企业版 RoleInstance 可归属于 Organization 和 Department，个人版 RoleInstance 不归属于 Department。
- RoleInstance 必须来源于 RoleTemplate，也允许企业级定制覆盖默认配置。
- Task 必须归属于一个 RoleInstance，不能脱离岗位存在。
- Workflow、Agent、Prompt、Tool 是底层执行对象，不是普通企业用户的主操作对象。
- 任务产物必须可追踪来源，包括模型、工具、知识库和人工审批记录。
- 成本记录必须能追溯到 Workspace、组织、岗位和任务。
- 所有受套餐限制的写操作必须经过 Entitlement 和 UsageMeter 检查。
