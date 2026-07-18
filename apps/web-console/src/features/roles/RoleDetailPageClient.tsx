'use client';

import type { CurrentAccountResponse, RoleInstanceDetail } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Link from 'next/link';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { withWorkspaceId } from '../common/workspace-href';

export function RoleDetailPageClient({
  currentAccount,
  role,
  isApiFallback
}: {
  currentAccount: CurrentAccountResponse;
  role: RoleInstanceDetail;
  isApiFallback: boolean;
}) {
  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title={role.name}
        description={role.businessGoal}
        actions={<Link href={withWorkspaceId('/tasks', currentAccount.activeWorkspaceId)}>查看任务</Link>}
      >
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}><QiuMetricCard title="完成任务" value={String(role.kpis.taskCompleted)} /></Col>
          <Col xs={24} md={6}><QiuMetricCard title="自动化率" value={`${Math.round(role.kpis.automationRate * 100)}%`} /></Col>
          <Col xs={24} md={6}><QiuMetricCard title="平均耗时" value={`${role.kpis.avgDurationMinutes} 分钟`} /></Col>
          <Col xs={24} md={6}><QiuMetricCard title="月成本" value={`¥${role.kpis.monthlyCost}`} /></Col>
        </Row>
        <Card bordered={false}>
          <Descriptions column={2} title={<Space>岗位信息<QiuStatusTag tone="processing">{role.status}</QiuStatusTag></Space>}>
            <Descriptions.Item label="部门">{role.departmentName || '未分配'}</Descriptions.Item>
            <Descriptions.Item label="负责人">{role.ownerName}</Descriptions.Item>
            <Descriptions.Item label="审批规则">{role.approvalPolicy}</Descriptions.Item>
            <Descriptions.Item label="安装时间">{role.installedAt}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="知识来源" bordered={false}>
              <List dataSource={role.knowledgeSources} renderItem={(item) => <List.Item>{item}</List.Item>} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="工具能力" bordered={false}>
              <List dataSource={role.tools} renderItem={(item) => <List.Item>{item}</List.Item>} />
            </Card>
          </Col>
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
