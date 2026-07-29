import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  qiuaiUserAgreementDocument,
  qiuaiUserAgreementKey,
  qiuaiUserAgreementRequiredReadSeconds
} from '../shared/desktop-agreements.js';
import type {
  DesktopAgreementAcceptRequest,
  DesktopAgreementAcceptanceSummary,
  DesktopAgreementDocumentSummary,
  DesktopAgreementStatus
} from '../shared/desktop-api.js';
import {
  acceptDesktopAgreement,
  fetchDesktopAgreementAcceptanceStatus
} from '../shared/desktop-sync-client.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

interface LocalAgreementAcceptanceRecord extends DesktopAgreementAcceptanceSummary {
  cloudSynced: boolean;
  cachedAt: string;
}

interface StoredAgreementAcceptances {
  schemaVersion: 1;
  records: LocalAgreementAcceptanceRecord[];
}

const agreementAcceptancesFileName = 'agreement-acceptances.json';
const currentAgreementContentHash = createAgreementContentHash();

export async function getUserAgreementStatus(): Promise<DesktopAgreementStatus> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const agreement = getCurrentAgreementSummary();
  const localAcceptance = readLocalAgreementAcceptance(appInfo.userDataPath, {
    agreementKey: agreement.agreementKey,
    agreementVersion: agreement.agreementVersion,
    contentHash: agreement.contentHash,
    runtimeId: identity.runtimeId,
    deviceId: identity.deviceId
  });

  try {
    const response = await fetchDesktopAgreementAcceptanceStatus(appInfo.serverBaseUrl, {
      agreementKey: agreement.agreementKey,
      agreementVersion: agreement.agreementVersion,
      contentHash: agreement.contentHash,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId
    });

    if (response.data.accepted && response.data.acceptance) {
      writeLocalAgreementAcceptance(appInfo.userDataPath, {
        ...response.data.acceptance,
        cloudSynced: true,
        cachedAt: new Date().toISOString()
      });

      return {
        agreement,
        accepted: true,
        cloudSynced: true,
        acceptance: response.data.acceptance
      };
    }

    return {
      agreement,
      accepted: false,
      cloudSynced: false
    };
  } catch (error) {
    if (localAcceptance) {
      return {
        agreement,
        accepted: true,
        cloudSynced: localAcceptance.cloudSynced,
        acceptance: localAcceptance,
        message: '已使用本地协议同意记录进入。云端连接恢复后会继续校验。'
      };
    }

    return {
      agreement,
      accepted: false,
      cloudSynced: false,
      message: error instanceof Error
        ? `无法连接服务端校验协议状态：${error.message}`
        : '无法连接服务端校验协议状态。'
    };
  }
}

export async function acceptUserAgreement(
  input: DesktopAgreementAcceptRequest
): Promise<DesktopAgreementStatus> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const agreement = getCurrentAgreementSummary();
  const response = await acceptDesktopAgreement(appInfo.serverBaseUrl, {
    agreementKey: agreement.agreementKey,
    agreementVersion: agreement.agreementVersion,
    contentHash: agreement.contentHash,
    runtimeId: identity.runtimeId,
    deviceId: identity.deviceId,
    workspaceId: identity.workspaceId,
    deviceName: appInfo.deviceName,
    platform: mapPlatform(appInfo.platform),
    appVersion: appInfo.appVersion,
    consentMethod: 'pc_first_launch_countdown_10s',
    minimumReadSeconds: agreement.requiredReadSeconds,
    actualReadSeconds: Math.max(0, Math.floor(input.actualReadSeconds)),
    deviceToken: identity.deviceToken
  });

  writeLocalAgreementAcceptance(appInfo.userDataPath, {
    ...response.data,
    cloudSynced: true,
    cachedAt: new Date().toISOString()
  });

  return {
    agreement,
    accepted: true,
    cloudSynced: true,
    acceptance: response.data
  };
}

function getCurrentAgreementSummary(): DesktopAgreementDocumentSummary {
  return {
    agreementKey: qiuaiUserAgreementKey,
    agreementVersion: qiuaiUserAgreementDocument.version,
    contentHash: currentAgreementContentHash,
    title: qiuaiUserAgreementDocument.title,
    effectiveDate: qiuaiUserAgreementDocument.effectiveDate,
    requiredReadSeconds: qiuaiUserAgreementRequiredReadSeconds
  };
}

function createAgreementContentHash(): string {
  const canonical = JSON.stringify({
    key: qiuaiUserAgreementKey,
    title: qiuaiUserAgreementDocument.title,
    version: qiuaiUserAgreementDocument.version,
    effectiveDate: qiuaiUserAgreementDocument.effectiveDate,
    summary: qiuaiUserAgreementDocument.summary,
    legalBasis: qiuaiUserAgreementDocument.legalBasis,
    sections: qiuaiUserAgreementDocument.sections
  });

  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function readLocalAgreementAcceptance(
  userDataPath: string,
  key: {
    agreementKey: string;
    agreementVersion: string;
    contentHash: string;
    runtimeId: string;
    deviceId: string;
  }
): LocalAgreementAcceptanceRecord | undefined {
  const store = readLocalAgreementStore(userDataPath);
  return store.records.find(
    (record) =>
      record.agreementKey === key.agreementKey &&
      record.agreementVersion === key.agreementVersion &&
      record.contentHash === key.contentHash &&
      record.runtimeId === key.runtimeId &&
      record.deviceId === key.deviceId
  );
}

function writeLocalAgreementAcceptance(
  userDataPath: string,
  record: LocalAgreementAcceptanceRecord
): void {
  const store = readLocalAgreementStore(userDataPath);
  const existingIndex = store.records.findIndex(
    (item) =>
      item.agreementKey === record.agreementKey &&
      item.agreementVersion === record.agreementVersion &&
      item.contentHash === record.contentHash &&
      item.runtimeId === record.runtimeId &&
      item.deviceId === record.deviceId
  );

  if (existingIndex >= 0) {
    store.records[existingIndex] = record;
  } else {
    store.records.unshift(record);
  }

  const filePath = getLocalAgreementStorePath(userDataPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8' });
}

function readLocalAgreementStore(userDataPath: string): StoredAgreementAcceptances {
  const filePath = getLocalAgreementStorePath(userDataPath);
  if (!existsSync(filePath)) {
    return {
      schemaVersion: 1,
      records: []
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredAgreementAcceptances>;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.records)) {
      return {
        schemaVersion: 1,
        records: parsed.records.filter(isLocalAgreementAcceptanceRecord)
      };
    }
  } catch {
    return {
      schemaVersion: 1,
      records: []
    };
  }

  return {
    schemaVersion: 1,
    records: []
  };
}

function getLocalAgreementStorePath(userDataPath: string): string {
  return path.join(userDataPath, agreementAcceptancesFileName);
}

function isLocalAgreementAcceptanceRecord(value: unknown): value is LocalAgreementAcceptanceRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Partial<LocalAgreementAcceptanceRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.agreementKey === 'string' &&
    typeof record.agreementVersion === 'string' &&
    typeof record.contentHash === 'string' &&
    typeof record.runtimeId === 'string' &&
    typeof record.deviceId === 'string' &&
    typeof record.acceptedAt === 'string' &&
    typeof record.consentMethod === 'string' &&
    typeof record.cloudSynced === 'boolean' &&
    typeof record.cachedAt === 'string'
  );
}

function mapPlatform(platform: NodeJS.Platform): 'windows' | 'macos' | 'linux' {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}
