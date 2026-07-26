import type { PaginationMeta } from './pagination';

export type DesktopReleasePlatform = 'windows';
export type DesktopReleaseChannel = 'stable';
export type DesktopReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface DesktopReleaseSummary {
  id: string;
  version: string;
  platform: DesktopReleasePlatform;
  channel: DesktopReleaseChannel;
  downloadUrl: string;
  releaseNotes?: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  forceUpdate: boolean;
  minimumSupportedVersion?: string;
  status: DesktopReleaseStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdminDesktopReleasesQuery {
  page?: number;
  pageSize?: number;
  status?: DesktopReleaseStatus;
  platform?: DesktopReleasePlatform;
  channel?: DesktopReleaseChannel;
}

export interface ListAdminDesktopReleasesResponse {
  data: DesktopReleaseSummary[];
  pagination: PaginationMeta;
}

export interface CreateAdminDesktopReleaseRequest {
  version: string;
  platform?: DesktopReleasePlatform;
  channel?: DesktopReleaseChannel;
  downloadUrl: string;
  releaseNotes?: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  forceUpdate?: boolean;
  minimumSupportedVersion?: string;
  status?: DesktopReleaseStatus;
}

export interface CreateAdminDesktopReleaseResponse {
  data: DesktopReleaseSummary;
}

export interface UpdateAdminDesktopReleaseRequest {
  version?: string;
  platform?: DesktopReleasePlatform;
  channel?: DesktopReleaseChannel;
  downloadUrl?: string;
  releaseNotes?: string | null;
  checksumSha256?: string | null;
  fileSizeBytes?: number | null;
  forceUpdate?: boolean;
  minimumSupportedVersion?: string | null;
  status?: DesktopReleaseStatus;
}

export interface UpdateAdminDesktopReleaseResponse {
  data: DesktopReleaseSummary;
}

export interface PublishAdminDesktopReleaseResponse {
  data: DesktopReleaseSummary;
}

export interface ArchiveAdminDesktopReleaseResponse {
  data: DesktopReleaseSummary;
}

export interface DesktopReleaseAssetSummary {
  fileName: string;
  originalFileName: string;
  downloadUrl: string;
  checksumSha256: string;
  fileSizeBytes: number;
  contentType: string;
}

export interface UploadAdminDesktopReleaseAssetResponse {
  data: DesktopReleaseAssetSummary;
}

export interface CheckDesktopUpdateQuery {
  currentVersion?: string;
  platform?: DesktopReleasePlatform;
  channel?: DesktopReleaseChannel;
}

export interface CheckDesktopUpdateResponse {
  data: {
    currentVersion?: string;
    updateAvailable: boolean;
    forceUpdate: boolean;
    latestRelease?: DesktopReleaseSummary;
  };
}
