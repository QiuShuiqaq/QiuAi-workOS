import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  prepareDesktopStoragePathInfo,
  resolveDesktopStoragePathInfo
} from './storage-paths.js';

const installRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-install-'));
const roamingRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-roaming-'));

const packagedStorage = resolveDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(installRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(packagedStorage.installPath, installRoot);
assert.equal(packagedStorage.storageMode, 'fallback_user_dir');
assert.equal(packagedStorage.dataPath, path.join(roamingRoot, 'QiuAI WorkOS'));

const blockedInstallRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-blocked-'));
writeFileSync(path.join(blockedInstallRoot, 'data'), 'blocked', { encoding: 'utf8' });

const fallbackUserDir = resolveDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(blockedInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(fallbackUserDir.installPath, blockedInstallRoot);
assert.equal(fallbackUserDir.storageMode, 'fallback_user_dir');
assert.equal(fallbackUserDir.dataPath, path.join(roamingRoot, 'QiuAI WorkOS'));

const previousDevUserDataDir = process.env.QIUAI_PC_DEV_USER_DATA_DIR;
delete process.env.QIUAI_PC_DEV_USER_DATA_DIR;

const devMode = resolveDesktopStoragePathInfo({
  isPackaged: false,
  processExecPath: path.join(installRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(devMode.storageMode, 'fallback_user_dir');
assert.equal(devMode.dataPath, path.resolve(process.cwd(), '.local', 'user-data'));

process.env.QIUAI_PC_DEV_USER_DATA_DIR = path.join(roamingRoot, 'dev-user-data');

const configuredDevMode = resolveDesktopStoragePathInfo({
  isPackaged: false,
  processExecPath: path.join(installRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(configuredDevMode.storageMode, 'fallback_user_dir');
assert.equal(configuredDevMode.dataPath, path.join(roamingRoot, 'dev-user-data'));

if (previousDevUserDataDir === undefined) {
  delete process.env.QIUAI_PC_DEV_USER_DATA_DIR;
} else {
  process.env.QIUAI_PC_DEV_USER_DATA_DIR = previousDevUserDataDir;
}

const preparedRoamingRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-prepared-roaming-'));
const preparedInstallRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-prepared-install-'));
const preparedStorage = prepareDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(preparedInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: preparedRoamingRoot
});
const preparedPointerPath = path.join(preparedRoamingRoot, 'QiuAI WorkOS', 'storage-location.json');
const preparedPointer = JSON.parse(readFileSync(preparedPointerPath, 'utf8')) as { dataPath?: string };

assert.equal(preparedStorage.storageMode, 'fallback_user_dir');
assert.equal(preparedPointer.dataPath, preparedStorage.dataPath);

const previousDataRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-previous-data-'));
writeFileSync(path.join(previousDataRoot, 'runtime-identity.json'), 'previous-identity', { encoding: 'utf8' });
mkdirSync(path.join(previousDataRoot, 'Local Storage', 'leveldb'), { recursive: true });
writeFileSync(path.join(previousDataRoot, 'Local Storage', 'leveldb', '000003.log'), 'previous-local-storage', {
  encoding: 'utf8'
});
mkdirSync(path.join(previousDataRoot, 'workspaces', 'workspace-a', 'state'), { recursive: true });
mkdirSync(path.join(previousDataRoot, 'workspaces', 'workspace-a', 'db'), { recursive: true });
writeFileSync(path.join(previousDataRoot, 'workspaces', 'workspace-a', 'state', 'workspace-profile.json'), '{}\n', {
  encoding: 'utf8'
});
writeFileSync(path.join(previousDataRoot, 'workspaces', 'workspace-a', 'db', 'workbench.sqlite'), 'sqlite-data', {
  encoding: 'utf8'
});

const migrationRoamingRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-migration-roaming-'));
mkdirSync(path.join(migrationRoamingRoot, 'QiuAI WorkOS'), { recursive: true });
writeFileSync(
  path.join(migrationRoamingRoot, 'QiuAI WorkOS', 'storage-location.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      dataPath: previousDataRoot,
      updatedAt: new Date().toISOString()
    },
    null,
    2
  )}\n`,
  { encoding: 'utf8' }
);

const migrationInstallRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-migration-install-'));
const migratedStorage = prepareDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(migrationInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: migrationRoamingRoot
});

assert.equal(readFileSync(path.join(migratedStorage.dataPath, 'runtime-identity.json'), 'utf8'), 'previous-identity');
assert.equal(
  readFileSync(path.join(migratedStorage.dataPath, 'Local Storage', 'leveldb', '000003.log'), 'utf8'),
  'previous-local-storage'
);
assert.ok(existsSync(path.join(migratedStorage.dataPath, 'workspaces', 'workspace-a', 'state', 'workspace-profile.json')));
assert.ok(existsSync(path.join(migratedStorage.dataPath, 'workspaces', 'workspace-a', 'db', 'workbench.sqlite')));

const existingTargetRoamingRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-existing-roaming-'));
const existingTargetSourceRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-existing-source-'));
writeFileSync(path.join(existingTargetSourceRoot, 'runtime-identity.json'), 'source-identity', { encoding: 'utf8' });
mkdirSync(path.join(existingTargetRoamingRoot, 'QiuAI WorkOS'), { recursive: true });
writeFileSync(
  path.join(existingTargetRoamingRoot, 'QiuAI WorkOS', 'storage-location.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      dataPath: existingTargetSourceRoot,
      updatedAt: new Date().toISOString()
    },
    null,
    2
  )}\n`,
  { encoding: 'utf8' }
);

const existingTargetInstallRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-existing-install-'));
const existingTargetDataPath = path.join(existingTargetRoamingRoot, 'QiuAI WorkOS');
mkdirSync(existingTargetDataPath, { recursive: true });
writeFileSync(path.join(existingTargetDataPath, 'runtime-identity.json'), 'target-identity', { encoding: 'utf8' });

const existingTargetStorage = prepareDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(existingTargetInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: existingTargetRoamingRoot
});

assert.equal(readFileSync(path.join(existingTargetStorage.dataPath, 'runtime-identity.json'), 'utf8'), 'target-identity');

const backupMigrationRoamingRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-backup-migration-roaming-'));
const backupMigrationInstallRoot = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-backup-migration-install-'));
const backupMigrationTargetRoot = path.join(backupMigrationRoamingRoot, 'QiuAI WorkOS');
const installerBackupRoot = path.join(backupMigrationTargetRoot, 'install-data-backup');
mkdirSync(backupMigrationTargetRoot, { recursive: true });
mkdirSync(installerBackupRoot, { recursive: true });
writeFileSync(
  path.join(backupMigrationTargetRoot, 'runtime-identity.json'),
  `${JSON.stringify(
    {
      runtimeId: 'runtime-target',
      deviceId: 'device-target',
      workspaceId: 'workspace_pending_login',
      createdAt: '2026-08-16T00:00:00.000Z'
    },
    null,
    2
  )}\n`,
  { encoding: 'utf8' }
);
writeFileSync(
  path.join(installerBackupRoot, 'runtime-identity.json'),
  `${JSON.stringify(
    {
      runtimeId: 'runtime-source',
      deviceId: 'device-source',
      workspaceId: 'workspace-account',
      deviceToken: 'source-device-token',
      createdAt: '2026-08-15T00:00:00.000Z'
    },
    null,
    2
  )}\n`,
  { encoding: 'utf8' }
);
mkdirSync(path.join(installerBackupRoot, 'workspaces', 'workspace-account', 'state'), { recursive: true });
writeFileSync(
  path.join(installerBackupRoot, 'workspaces', 'workspace-account', 'state', 'workspace-profile.json'),
  '{}\n',
  { encoding: 'utf8' }
);

const backupMigratedStorage = prepareDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(backupMigrationInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: backupMigrationRoamingRoot
});
const backupMigratedIdentity = JSON.parse(
  readFileSync(path.join(backupMigratedStorage.dataPath, 'runtime-identity.json'), 'utf8')
) as { workspaceId?: string; deviceToken?: string };

assert.equal(backupMigratedIdentity.workspaceId, 'workspace-account');
assert.equal(backupMigratedIdentity.deviceToken, 'source-device-token');
assert.ok(
  existsSync(
    path.join(backupMigratedStorage.dataPath, 'workspaces', 'workspace-account', 'state', 'workspace-profile.json')
  )
);

console.log('Desktop storage path resolution passed.');
