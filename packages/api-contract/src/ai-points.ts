export type OfficialModelRouteCapability = 'text' | 'reasoning' | 'image' | 'video' | 'audio';

export type OfficialModelRouteStatus = 'active' | 'disabled';

export type OfficialImageSize = '1K' | '2K' | '4K';

export interface OfficialModelRouteSummary {
  routeKey: string;
  displayName: string;
  capability: OfficialModelRouteCapability;
  status: OfficialModelRouteStatus;
  pointPrice: number;
  pointPricesByDurationSeconds?: Record<string, number>;
  supportedImageSizes?: OfficialImageSize[];
  defaultImageSize?: OfficialImageSize;
  pointPricesByImageSize?: Partial<Record<OfficialImageSize, number>>;
  sortOrder: number;
}

export interface AiPointWalletSummary {
  workspaceId: string;
  balancePoints: number;
  reservedPoints: number;
  availablePoints: number;
  updatedAt: string;
}

export type AiPointCreditBucketSourceType =
  | 'subscription_monthly'
  | 'purchase_permanent'
  | 'admin_grant'
  | 'referral_reward'
  | 'migrated_balance';

export type AiPointCreditBucketStatus = 'active' | 'expired' | 'cancelled';

export interface AiPointCreditBucketSummary {
  id: string;
  workspaceId: string;
  sourceType: AiPointCreditBucketSourceType;
  totalPoints: number;
  availablePoints: number;
  reservedPoints: number;
  startsAt: string;
  expiresAt?: string;
  status: AiPointCreditBucketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiPointLedgerEntrySummary {
  id: string;
  workspaceId: string;
  desktopDeviceId?: string;
  routeKey?: string;
  type: 'purchase' | 'grant' | 'reserve' | 'settle' | 'release' | 'adjustment';
  status: 'pending' | 'completed' | 'cancelled';
  points: number;
  balanceAfter?: number;
  description?: string;
  createdAt: string;
}

export interface DesktopDeviceAiQuotaSummary {
  desktopDeviceId: string;
  period: string;
  monthlyLimitPoints?: number;
  usedPointsThisMonth: number;
  reservedPoints: number;
  availablePoints?: number;
  status: 'active' | 'disabled';
}

export interface GetAiPointOverviewResponse {
  data: {
    wallet: AiPointWalletSummary;
    deviceQuota?: DesktopDeviceAiQuotaSummary;
    recentLedgerEntries: AiPointLedgerEntrySummary[];
    creditBuckets?: AiPointCreditBucketSummary[];
    routes: OfficialModelRouteSummary[];
  };
}

export interface ListOfficialModelRoutesResponse {
  data: OfficialModelRouteSummary[];
}

export interface InvokeOfficialModelRequest {
  officialRouteKey: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  timeoutMs?: number;
  taskKind?: 'chat' | 'image_generation' | 'video_generation' | 'audio_transcription' | 'audio_generation';
  visionInputs?: Array<{
    imageDataUrl?: string;
    mimeType?: string;
  }>;
  imageGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImageDataUrl?: string;
    size?: string;
    aspectRatio?: string;
    responseFormat?: 'url';
    asyncMode?: 'wait' | 'submit_only' | 'poll_once';
    providerJobId?: string;
  };
  videoGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImageDataUrl?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    responseFormat?: 'url';
  };
  audioGeneration?: {
    text: string;
    voicePresetId: string;
    language?: string;
    format?: 'mp3';
  };
}

export interface InvokeOfficialModelResponse {
  data: {
    provider: 'QiuAI官方通道';
    modelName: string;
    content: string;
    inputTokens?: number;
    outputTokens?: number;
    pointsCharged: number;
    wallet?: AiPointWalletSummary;
    artifacts?: Array<{
      type: 'image' | 'video' | 'file';
      title?: string;
      remoteUrl?: string;
      localPath?: string;
      thumbnailPath?: string;
      mimeType?: string;
      providerJobId?: string;
      providerStatus?: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}
