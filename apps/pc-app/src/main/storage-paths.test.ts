import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveDesktopStoragePathInfo } from './storage-paths.js';

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

const devMode = resolveDesktopStoragePathInfo({
  isPackaged: false,
  processExecPath: path.join(installRoot, 'QiuAI WorkOS.exe'),
  homeDir: os.homedir(),
  appDataPath: roamingRoot
});

assert.equal(devMode.storageMode, 'fallback_user_dir');
assert.equal(devMode.dataPath, path.resolve(process.cwd(), '.local', 'user-data'));

console.log('Desktop storage path resolution passed.');
