export type ReferralAccountPlanStatus = 'unregistered' | 'free' | 'member' | 'enterprise';

export interface ReferralRewardPolicy {
  inviteeRewardPoints: number;
  inviterRewardPoints: number;
  rewardExpiresInDays: number;
}

export interface ReferralOverview {
  workspaceId: string;
  accountStatus: ReferralAccountPlanStatus;
  canInvite: boolean;
  referralCode?: string;
  invitedPaidCount: number;
  earnedPoints: number;
  policy: ReferralRewardPolicy;
}

export interface GetReferralOverviewResponse {
  data: ReferralOverview;
}

export interface ValidateReferralCodeRequest {
  referralCode: string;
}

export interface ValidateReferralCodeResponse {
  data: {
    valid: boolean;
    message: string;
    policy: ReferralRewardPolicy;
  };
}
