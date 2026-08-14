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

const followInstall = resolveDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(installRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(followInstall.installPath, installRoot);
assert.equal(followInstall.storageMode, 'follow_install_dir');
assert.equal(followInstall.dataPath, path.join(installRoot, 'data'));
assert.ok(existsSync(followInstall.dataPath));

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

assert.equal(preparedStorage.storageMode, 'follow_install_dir');
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
const existingTargetDataPath = path.join(existingTargetInstallRoot, 'data');
mkdirSync(existingTargetDataPath, { recursive: true });
writeFileSync(path.join(existingTargetDataPath, 'runtime-identity.json'), 'target-identity', { encoding: 'utf8' });

const existingTargetStorage = prepareDesktopStoragePathInfo({
  isPackaged: true,
  processExecPath: path.join(existingTargetInstallRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: existingTargetRoamingRoot
});

assert.equal(readFileSync(path.join(existingTargetStorage.dataPath, 'runtime-identity.json'), 'utf8'), 'target-identity');

console.log('Desktop storage path resolution passed.');
