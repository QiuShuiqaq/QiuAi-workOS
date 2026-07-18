# QiuAI WorkOS 前端 UI 架构

## 技术选择

前端采用 Ant Design 生态：

- Web 控制台：Ant Design + Ant Design Pro 风格
- AI 交互界面：Ant Design X
- PC 端：Electron 承载桌面体验，复用 Web 能力
- 移动端：React Native + Expo
- 移动 H5 或轻量页面：可按需使用 Ant Design Mobile

## 为什么选择 Ant Design

QiuAI WorkOS 是企业数字劳动力平台，会长期包含：

- 企业组织架构
- 部门和成员
- 岗位配置
- 任务中心
- 审批
- 审计
- 成本看板
- 工具连接器
- 模型配置

这些界面更接近企业后台和操作系统，不适合用普通 Dashboard 模板堆页面。Ant Design 在表单、表格、弹窗、布局、导航和企业后台场景上更稳。

## QiuAI UI 组件策略

不要在业务页面里到处直接使用 Ant Design 原始组件。应先封装 QiuAI 业务组件：

```text
QiuPage
QiuTable
QiuForm
QiuStatusTag
QiuWorkspaceSwitcher
QiuRoleCard
QiuTaskTimeline
QiuApprovalPanel
QiuCostBadge
```

当前已创建第一批基础组件：

- `QiuPage`
- `QiuStatusTag`
- `QiuWorkspaceSwitcher`

后续页面开发时，如果某个 Ant Design 组合模式出现第二次，就应考虑沉淀到 `packages/ui`。

## 设计 Token

统一主题入口为 `packages/design-tokens`。

当前包含：

- 品牌色
- 成功、警告、危险色
- 文本色
- 边框色
- 表面色
- 圆角
- Ant Design 主题 token

后续不要在页面中散落大量硬编码颜色。页面级样式如果稳定复用，应沉淀为 token 或业务组件。

## 多端一致性

Web、PC 和移动端不需要视觉完全相同，但必须保持：

- 相同领域语言
- 相同状态命名
- 相同 API 契约
- 相同权益判断来源
- 相同任务和岗位核心交互模型

移动端应优先服务高频轻操作，例如：

- 查看任务
- 审批任务
- 查看执行状态
- 接收通知
- 简单创建任务

复杂配置仍优先在 Web 和 PC 端完成。
