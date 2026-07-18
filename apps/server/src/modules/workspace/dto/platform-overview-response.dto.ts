import { ApiProperty } from '@nestjs/swagger';

import { WorkspaceSummaryDto } from './current-account-response.dto';

export class PlatformMetricSummaryDto {
  @ApiProperty({ example: 'roles' })
  key!: string;

  @ApiProperty({ example: 'AI 岗位' })
  title!: string;

  @ApiProperty({ example: '12' })
  value!: string;

  @ApiProperty({ example: '+2 本月', required: false })
  trend?: string;
}

export class RoleRuntimeSummaryDto {
  @ApiProperty({ example: 'role_case_ops' })
  id!: string;

  @ApiProperty({ example: 'AI案例运营专员' })
  name!: string;

  @ApiProperty({ example: '运营部', required: false })
  departmentName?: string;

  @ApiProperty({ example: 'running' })
  status!: 'running' | 'trial' | 'configuration_required' | 'paused';
}

export class TaskRuntimeSummaryDto {
  @ApiProperty({ example: 'task_case_screening' })
  id!: string;

  @ApiProperty({ example: '案例视频初筛' })
  title!: string;

  @ApiProperty({ example: 'AI案例运营专员' })
  roleName!: string;

  @ApiProperty({ example: 'completed' })
  state!: 'completed' | 'running' | 'waiting_approval' | 'failed';
}

export class PlatformOverviewResponseDto {
  @ApiProperty({ type: WorkspaceSummaryDto })
  workspace!: WorkspaceSummaryDto;

  @ApiProperty({ type: [PlatformMetricSummaryDto] })
  metrics!: PlatformMetricSummaryDto[];

  @ApiProperty({ type: [RoleRuntimeSummaryDto] })
  roles!: RoleRuntimeSummaryDto[];

  @ApiProperty({ type: [TaskRuntimeSummaryDto] })
  tasks!: TaskRuntimeSummaryDto[];
}
