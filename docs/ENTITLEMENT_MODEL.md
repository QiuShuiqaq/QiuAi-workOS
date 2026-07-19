# QiuAI WorkOS 套餐与权益模型

## 设计目标

QiuAI WorkOS 是商业化项目，必须从系统架构层面支持免费个人版和收费企业版。

套餐与权益模型要解决：

- 个人版免费使用，但能力受控
- 企业版支持月度订阅和年度订阅
- 企业版以企业 Organization 为核心
- 企业版支持 Department、成员、权限、审批、审计和成本治理
- PC 端、Web 端、移动端使用同一套权益判断
- 后端负责最终权益校验，前端只负责展示和引导升级

## 核心版本

### Personal Free

个人免费版，面向个人用户、小团队探索者和产品试用者。

能力范围：

- 个人 Workspace
- 单人使用
- 可搭建少量 AI 员工
- 基础岗位模板
- 基础任务中心
- 基础知识库
- 基础执行记录
- 基础成本展示

不支持：

- 企业 Organization
- Department
- 成员邀请
- 企业级 IAM
- 审批流
- 审计日志
- 成本预算
- 高级工具连接器
- 企业绩效看板

### Enterprise Basic

企业基础版，面向刚开始使用 AI 岗位的小企业。

价格：

- ¥299/月
- ¥2,990/年

能力范围：

- 企业 Workspace
- Organization
- Department
- 多成员
- 基础 AI 岗位额度
- 岗位归属和负责人
- 企业知识库
- 权限管理
- 审批流
- 审计日志
- 成本统计

### Enterprise Standard

企业标准版，面向稳定使用多个 AI 岗位的企业。

价格：

- ¥599/月
- ¥5,990/年

在 Enterprise Basic 基础上提供：

- 更高岗位数量
- 更高任务量
- 更高存储额度
- 高级工具连接器
- KPI 看板

### Enterprise Professional

企业专业版，面向更高任务量和更完整治理需求的企业。

价格：

- ¥980/月
- ¥9,800/年

在 Enterprise Standard 基础上提供：

- 更高岗位数量
- 更高任务量
- 更高存储额度
- 更高成员额度
- 面向高频数字岗位运营的完整治理能力

### Enterprise Custom

企业定制版，面向中大型客户或私有化部署客户。

能力范围：

- 私有化或专属部署
- 高级组织和权限策略
- 高级审计
- 高级成本预算
- 专属模型配置
- 专属工具连接
- 专属实施和 SLA

## 核心对象

### Plan

套餐定义。Plan 是静态商业配置，不直接记录某个客户的订阅状态。

关键字段：

- code
- name
- billingCycle
- price
- currency
- entitlementSet
- status

基础 code：

```text
PERSONAL_FREE
ENTERPRISE_BASIC_MONTHLY
ENTERPRISE_BASIC_ANNUAL
ENTERPRISE_STANDARD_MONTHLY
ENTERPRISE_STANDARD_ANNUAL
ENTERPRISE_PRO_MONTHLY
ENTERPRISE_PRO_ANNUAL
ENTERPRISE_CUSTOM
```

### Subscription

订阅记录。Subscription 归属于 Workspace。

关键字段：

- workspaceId
- planCode
- status
- billingCycle
- currentPeriodStart
- currentPeriodEnd
- cancelAtPeriodEnd

### Entitlement

功能权益和额度定义。

示例：

```text
maxRoleInstances
maxTasksPerMonth
maxKnowledgeBases
maxStorageGB
maxMembers
canCreateDepartment
canInviteMember
canUseApprovalPolicy
canUseAuditLog
canUseAdvancedToolConnector
canUseCostBudget
canUseEnterpriseKPIDashboard
```

### UsageMeter

用量计量。UsageMeter 用于判断是否超过套餐额度。

示例：

```text
roleInstances.count
tasks.monthlyCount
knowledgeBases.count
storage.usedGB
members.count
modelTokens.monthlyCount
```

## 权益校验原则

所有受限写操作必须在服务端校验权益。

典型操作：

- 创建 AI 岗位
- 创建任务
- 创建知识库
- 上传文件
- 邀请成员
- 创建部门
- 启用审批流
- 启用审计日志
- 连接高级工具
- 设置成本预算

前端可以根据权益显示升级入口，但不能作为最终控制点。

## 统一错误语义

当用户没有权限或超出套餐额度时，API 应返回结构化错误。

示例错误码：

```text
ENTITLEMENT_REQUIRED
QUOTA_EXCEEDED
SUBSCRIPTION_INACTIVE
PLAN_UPGRADE_REQUIRED
```

示例响应：

```json
{
  "error": {
    "code": "PLAN_UPGRADE_REQUIRED",
    "message": "This feature requires an Enterprise plan.",
    "details": {
      "featureKey": "canCreateDepartment",
      "requiredPlan": "ENTERPRISE_BASIC_MONTHLY"
    }
  }
}
```

## 架构约束

- 个人版和企业版共用同一套平台内核。
- Workspace 是多端主要上下文。
- 个人版 Workspace 不创建 Organization 和 Department。
- 企业版 Workspace 必须绑定 Organization。
- Department、成员邀请、企业权限、审批、审计和成本预算属于企业版权益。
- 角色、任务、执行、产物、日志和成本记录必须归属于 Workspace。
- 不允许在 Web、PC、移动端分别实现套餐判断。
