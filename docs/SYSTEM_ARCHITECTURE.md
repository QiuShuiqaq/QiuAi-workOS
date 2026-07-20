# QiuAI WorkOS 系统架构

本文是 QiuAI WorkOS 的系统级边界说明。  
它定义“谁负责什么、数据放哪里、能力如何分层”，用于统一 Web、PC、Mobile、Server 的开发方向。

相关决策见 `docs/decisions/ADR-009-console-boundaries.md`。

## 1. 产品定位

QiuAI WorkOS 是企业数字劳动力平台，不是单纯的聊天机器人、工作流工具或知识库系统。

核心目标：

- 把企业中的真实岗位，转化为可运行、可管理、可考核的数字岗位
- 让企业像管理员工一样管理 AI 岗位
- 让模型、工具、流程、知识、权限和审批成为岗位能力的一部分

## 2. 系统总图

```text
Enterprise / Personal Users
    │
    ├── admin-console  # 平台运营后台
    ├── web-console    # 企业门户 / 总控台
    ├── pc-app         # 数字员工主工作台
    └── mobile-app     # 轻量指令与审批端
            │
            └── server control plane
                    ├── auth / workspace / org / department
                    ├── plan / subscription / entitlement / billing
                    ├── role templates / role instances / task summaries
                    ├── audit / cost / usage / sync metadata
                    └── API contracts
```

## 3. 四端职责

### admin-console

平台内部运营后台，只给平台方使用。

负责：

- 租户管理
- 套餐管理
- 模板审核
- 账单与订单运营
- 系统健康与告警
- 审计与风控查看

### web-console

企业门户和总控台，给企业老板、管理员和普通成员使用。

负责：

- 登录与 Workspace 切换
- 企业概览
- Organization / Department 管理
- 岗位、任务、审批、成本、绩效查看
- 桌面端绑定与状态查看
- 个人版与企业版的统一入口

### pc-app

企业数字员工主工作台，桌面端是核心操作面。

负责：

- 岗位包安装与升级
- 模型接入与校验
- 工具注册与权限范围控制
- 本地知识绑定
- 本地任务执行
- 日志、产物、成本查看
- 仅回传摘要、状态和审计信息到服务端

### mobile-app

轻量管理端。

负责：

- 接收通知
- 查看任务状态
- 审批
- 发起简单指令

## 4. 服务端职责

服务端是 control plane，不是重资产存储层，也不是桌面执行层。

服务端负责：

- 账号、租户、Workspace
- 组织、部门、成员
- 套餐、订阅、权益、计量、账单
- 岗位模板目录与岗位实例摘要
- 审计、成本、用量、同步元数据
- 对外统一 API 契约

服务端不负责：

- 大文件资产的主存储
- 桌面本地执行细节
- 用户私钥和本地工具凭据
- 复杂 UI 运行逻辑

## 5. 数据放置原则

### 放在服务端

- 账号与认证状态
- Workspace / Organization / Department 元数据
- 套餐、订阅、权益、订单、发票
- 审计日志
- 成本汇总与用量汇总
- 岗位模板元数据
- 任务摘要与同步状态

### 放在桌面端

- 模型凭据
- 工具凭据
- 本地知识索引
- 本地文件与素材
- 本地生成产物
- 运行日志与调试记录
- 离线可恢复状态

### 同步回服务端

- 任务摘要
- 执行状态
- 成本摘要
- 审计事件
- 可展示的产物引用

## 6. 核心系统层

### 商业治理层

Plan、Subscription、Entitlement、UsageMeter、BillingAccount。

### 组织协作层

Tenant、Account、Workspace、Organization、Department、Member。

### 岗位层

RoleTemplate、RoleInstance、RoleConfig、KPI。

### 能力层

ModelConfig、ToolConnector、KnowledgeBase、Memory、WorkflowDefinition、AgentDefinition。

### 执行层

Task、Job、WorkflowRun、AgentRun、Artifact、Approval、Retry。

### 治理层

AuditLog、CostRecord、QualityMetric、Alert。

## 7. 标准业务流

```text
创建企业或个人 Workspace
    -> 安装岗位
    -> 配置模型 / 工具 / 知识
    -> 绑定部门和负责人
    -> 本地运行岗位
    -> 生成产物和日志
    -> 汇总成本与审计
    -> 同步摘要到服务端
```

## 8. 关键边界

- 普通企业用户不直接面对 Workflow Canvas
- Dify / LangGraph 类能力只能作为内部执行适配层
- 客户端不重复实现权益判断
- 服务端不存重资产
- PC 端是企业数字员工的主工作面
- Web 端是企业总控台，不是执行壳

