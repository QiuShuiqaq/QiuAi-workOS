export type KnowledgeBaseScope = 'enterprise' | 'local';

export type KnowledgeBaseStatus = 'active' | 'disabled';

export type KnowledgeBaseVersionStatus = 'processing' | 'ready' | 'failed' | 'archived';

export interface EnterpriseKnowledgeProfile {
  companyName?: string;
  industry?: string;
  businessScope?: string;
  productsAndServices?: string;
  targetCustomers?: string;
  customerPersona?: string;
  salesGuidelines?: string;
  serviceBoundaries?: string;
  forbiddenClaims?: string;
  commonQuestions?: string;
  pricingAndDelivery?: string;
  afterSalesPolicy?: string;
  contactInfo?: string;
  notes?: string;
}

export interface KnowledgeBaseVersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sourceSha256: string;
  status: KnowledgeBaseVersionStatus;
  isEnabled: boolean;
  summary: string;
  textPreview: string;
  failureMessage?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseKnowledgeBaseSummary {
  id: string;
  workspaceId: string;
  scope: 'enterprise';
  name: string;
  status: KnowledgeBaseStatus;
  profile: EnterpriseKnowledgeProfile;
  currentVersion?: KnowledgeBaseVersionSummary;
  versions: KnowledgeBaseVersionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseKnowledgeBaseDocument {
  versionId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentBase64: string;
}

export interface EnterpriseKnowledgeRuntimeContext {
  workspaceId: string;
  enabled: boolean;
  versionId?: string;
  versionNumber?: number;
  title?: string;
  fileName?: string;
  contextText: string;
  updatedAt: string;
}

export interface GetEnterpriseKnowledgeBaseResponse {
  data: EnterpriseKnowledgeBaseSummary;
}

export interface UpdateEnterpriseKnowledgeProfileRequest {
  profile: EnterpriseKnowledgeProfile;
}

export interface UpdateEnterpriseKnowledgeProfileResponse {
  data: EnterpriseKnowledgeBaseSummary;
}

export interface UploadEnterpriseKnowledgePdfRequest {
  fileName: string;
  contentBase64: string;
  title?: string;
  activate?: boolean;
}

export interface UploadEnterpriseKnowledgePdfResponse {
  data: EnterpriseKnowledgeBaseSummary;
}

export interface ActivateEnterpriseKnowledgeVersionResponse {
  data: EnterpriseKnowledgeBaseSummary;
}

export interface UpdateEnterpriseKnowledgeStatusRequest {
  enabled: boolean;
}

export interface UpdateEnterpriseKnowledgeStatusResponse {
  data: EnterpriseKnowledgeBaseSummary;
}

export interface GetEnterpriseKnowledgeDocumentResponse {
  data: EnterpriseKnowledgeBaseDocument;
}

export interface GetEnterpriseKnowledgeRuntimeContextResponse {
  data: EnterpriseKnowledgeRuntimeContext;
}
