export type AssetDefinitionType =
  | 'VARIABLE'
  | 'MODEL'
  | 'TOOL'
  | 'ARTIFACT_TEMPLATE'
  | 'NODE_TEMPLATE';

export type AssetDefinitionStatus = 'ACTIVE' | 'DISABLED' | 'ARCHIVED';

export type AssetDefinitionScope = 'SYSTEM' | 'CUSTOM';

export interface AssetDefinitionDetail {
  id: string;
  type: AssetDefinitionType;
  key: string;
  name: string;
  description?: string;
  category: string;
  status: AssetDefinitionStatus;
  scope: AssetDefinitionScope;
  version: string;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdminAssetDefinitionsQuery {
  type?: AssetDefinitionType;
  status?: AssetDefinitionStatus;
  query?: string;
}

export interface ListAdminAssetDefinitionsResponse {
  data: AssetDefinitionDetail[];
}

export interface CreateAdminAssetDefinitionRequest {
  type: AssetDefinitionType;
  key: string;
  name: string;
  description?: string;
  category?: string;
  status?: AssetDefinitionStatus;
  scope?: AssetDefinitionScope;
  version?: string;
  schema?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  tags?: string[];
  sortOrder?: number;
}

export interface CreateAdminAssetDefinitionResponse {
  data: AssetDefinitionDetail;
}

export interface UpdateAdminAssetDefinitionRequest {
  key?: string;
  name?: string;
  description?: string | null;
  category?: string;
  status?: AssetDefinitionStatus;
  scope?: AssetDefinitionScope;
  version?: string;
  schema?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  tags?: string[];
  sortOrder?: number;
}

export interface UpdateAdminAssetDefinitionResponse {
  data: AssetDefinitionDetail;
}

export interface DeleteAdminAssetDefinitionResponse {
  data: {
    id: string;
    deleted: true;
  };
}
