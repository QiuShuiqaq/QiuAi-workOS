import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceInvitationSummaryDto {
  @ApiProperty({ example: 'invite_001' })
  id!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceId!: string;

  @ApiProperty({ example: 'ops2@qiuai.local' })
  email!: string;

  @ApiProperty({ example: 'member' })
  systemRole!: 'admin' | 'member' | 'viewer';

  @ApiProperty({ example: 'dept_operations', required: false, nullable: true })
  departmentId?: string;

  @ApiProperty({ example: '运营部', required: false, nullable: true })
  departmentName?: string;

  @ApiProperty({ example: 'pending' })
  status!: 'pending' | 'accepted' | 'cancelled' | 'expired';

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-07-20T01:00:00.000Z', required: false, nullable: true })
  acceptedAt?: string;

  @ApiProperty({ example: '2026-07-20T00:00:00.000Z' })
  createdAt!: string;
}

export class PublicInvitationDetailDto {
  @ApiProperty({ example: 'ops2@qiuai.local' })
  email!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceId!: string;

  @ApiProperty({ example: 'QiuAI Demo Enterprise' })
  workspaceName!: string;

  @ApiProperty({ example: 'QiuAI Demo Enterprise', required: false, nullable: true })
  organizationName?: string;

  @ApiProperty({ example: 'member' })
  systemRole!: 'admin' | 'member' | 'viewer';

  @ApiProperty({ example: '运营部', required: false, nullable: true })
  departmentName?: string;

  @ApiProperty({ example: 'pending' })
  status!: 'pending' | 'accepted' | 'cancelled' | 'expired';

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  expiresAt!: string;
}

export class ListWorkspaceInvitationsResponseDto {
  @ApiProperty({ type: [WorkspaceInvitationSummaryDto] })
  data!: WorkspaceInvitationSummaryDto[];
}

export class CreateWorkspaceInvitationResponseDto {
  @ApiProperty({ type: WorkspaceInvitationSummaryDto })
  data!: WorkspaceInvitationSummaryDto;

  @ApiProperty({ example: 'https://workos.qiuaihub.com/invitations/abc123' })
  inviteUrl!: string;
}

export class CancelWorkspaceInvitationResponseDto {
  @ApiProperty({ type: WorkspaceInvitationSummaryDto })
  data!: WorkspaceInvitationSummaryDto;
}

export class GetPublicInvitationResponseDto {
  @ApiProperty({ type: PublicInvitationDetailDto })
  data!: PublicInvitationDetailDto;
}
