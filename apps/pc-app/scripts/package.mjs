import { mkdir, cp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

import {
  copyRuntimePackages,
  ensureExists,
  ensureRuntimePackageSources
} from './runtime-dependencies.mjs';

const require = createRequire(import.meta.url);
const appDir = path.resolve(process.cwd());
const releaseDir = path.join(appDir, 'release', 'pc-app');
const distDir = path.join(appDir, 'dist');
const resourcesDir = path.join(appDir, 'resources');
const packageJsonPath = path.join(appDir, 'package.json');
const electronPackageJsonPath = require.resolve('electron/package.json');
const electronDistDir = path.join(path.dirname(electronPackageJsonPath), 'dist');

await ensureExists(distDir, 'build output directory');
await ensureExists(path.join(resourcesDir, 'icon.png'), 'desktop window icon');
await ensureExists(path.join(resourcesDir, 'icon.ico'), 'Windows app icon');
await ensureExists(electronDistDir, 'Electron runtime directory');
await ensureRuntimePackageSources();

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
await mkdir(path.join(releaseDir, 'node_modules'), { recursive: true });
await cp(distDir, path.join(releaseDir, 'dist'), { recursive: true });
await cp(resourcesDir, path.join(releaseDir, 'resources'), { recursive: true });
await cp(electronDistDir, path.join(releaseDir, 'electron'), { recursive: true });
await copyRuntimePackages(path.join(releaseDir, 'node_modules'));
await cp(packageJsonPath, path.join(releaseDir, 'package.json'));

await writeFile(
  path.join(releaseDir, 'launch.cmd'),
  '@echo off\r\nsetlocal\r\nset "DIR=%~dp0"\r\n"%DIR%electron\\electron.exe" "%DIR%"\r\n'
);

await writeFile(
  path.join(releaseDir, 'README.txt'),
  [
    'QiuAI WorkOS portable desktop bundle',
    '',
    'Launch: launch.cmd',
    'App root: ' + releaseDir,
    ''
  ].join('\r\n')
);

console.log(`Packaged desktop bundle at ${releaseDir}`);
