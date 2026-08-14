import { ApiProperty } from '@nestjs/swagger';

export class ReferralRewardPolicyDto {
  @ApiProperty({ example: 300 })
  inviteeRewardPoints!: number;

  @ApiProperty({ example: 500 })
  inviterRewardPoints!: number;

  @ApiProperty({ example: 90 })
  rewardExpiresInDays!: number;
}

export class ReferralOverviewDto {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 'member', enum: ['unregistered', 'free', 'member', 'enterprise'] })
  accountStatus!: 'unregistered' | 'free' | 'member' | 'enterprise';

  @ApiProperty({ example: true })
  canInvite!: boolean;

  @ApiProperty({ example: 'QIUAI8K2P', required: false })
  referralCode?: string;

  @ApiProperty({ example: 3 })
  invitedPaidCount!: number;

  @ApiProperty({ example: 1500 })
  earnedPoints!: number;

  @ApiProperty({ type: ReferralRewardPolicyDto })
  policy!: ReferralRewardPolicyDto;
}

export class GetReferralOverviewResponseDto {
  @ApiProperty({ type: ReferralOverviewDto })
  data!: ReferralOverviewDto;
}

export class ValidateReferralCodeDataDto {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ example: '邀请码有效，开通会员后双方可获得 AI 点数。' })
  message!: string;

  @ApiProperty({ type: ReferralRewardPolicyDto })
  policy!: ReferralRewardPolicyDto;
}

export class ValidateReferralCodeResponseDto {
  @ApiProperty({ type: ValidateReferralCodeDataDto })
  data!: ValidateReferralCodeDataDto;
}
