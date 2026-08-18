import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  copyRuntimePackages,
  ensureExists,
  ensureRuntimePackageSources,
  getRuntimePackageDependencies,
  getRuntimePackageFileGlobs
} from './runtime-dependencies.mjs';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const appPackageJsonPath = path.join(appDir, 'package.json');
const distDir = path.join(appDir, 'dist');
const resourcesDir = path.join(appDir, 'resources');
const installerIncludeSourcePath = path.join(appDir, 'build', 'installer.nsh');
const releaseDir = path.join(appDir, 'release');
const stageDir = path.join(releaseDir, 'installer-stage');
const outputDir = path.join(releaseDir, 'installers');
const finalPackageRootDir = path.resolve('F:/Package/QiuAI-workOS');
const stageNodeModulesDir = path.join(stageDir, 'node_modules');
const stageConfigPath = path.join(stageDir, 'electron-builder.config.cjs');
const stagePackageJsonPath = path.join(stageDir, 'package.json');
const stageInstallerIncludePath = path.join(stageDir, 'installer.nsh');

const electronBuilderCliPath = require.resolve('electron-builder/cli.js');
const electronPackageJsonPath = require.resolve('electron/package.json');
const electronDistDir = path.join(path.dirname(electronPackageJsonPath), 'dist');
const runtimePackageFileGlobs = getRuntimePackageFileGlobs();

await ensureExists(distDir, 'build output directory');
await ensureExists(path.join(resourcesDir, 'icon.png'), 'desktop window icon');
await ensureExists(path.join(resourcesDir, 'icon.ico'), 'Windows app icon');
await ensureExists(installerIncludeSourcePath, 'Windows installer process guard include');
await ensureExists(electronDistDir, 'Electron runtime directory');
await ensureExists(electronBuilderCliPath, 'electron-builder CLI');
await ensureRuntimePackageSources();

const appPackageJson = JSON.parse(await readFile(appPackageJsonPath, 'utf8'));
const electronVersion = normalizePackageVersion(
  appPackageJson.devDependencies?.electron ?? appPackageJson.dependencies?.electron
);
const runtimeDependencies = await getRuntimePackageDependencies(appPackageJsonPath);

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await cp(distDir, path.join(stageDir, 'dist'), { recursive: true });
await cp(resourcesDir, path.join(stageDir, 'resources'), { recursive: true });
await cp(installerIncludeSourcePath, stageInstallerIncludePath);
await copyRuntimePackages(stageNodeModulesDir);

await writeFile(
  stagePackageJsonPath,
  JSON.stringify(
    {
      name: 'qiuai-workos-pc-installer-app',
      version: appPackageJson.version,
      private: true,
      type: 'module',
      description: appPackageJson.description,
      author: appPackageJson.author,
      main: 'dist/main/main.js',
      dependencies: runtimeDependencies
    },
    null,
    2
  )
);

await writeFile(
  stageConfigPath,
  [
    "const path = require('node:path');",
    '',
    'module.exports = {',
    "  appId: 'com.qiuai.workos.pc',",
    "  productName: 'QiuAI WorkOS',",
    `  electronVersion: '${electronVersion}',`,
    `  electronDist: ${JSON.stringify(electronDistDir)},`,
    '  asar: false,',
    '  npmRebuild: false,',
    '  nodeGypRebuild: false,',
    '  directories: {',
    "    output: path.resolve(__dirname, '..', 'installers')",
    '  },',
    '  files: [',
    "    'dist/**/*',",
    "    'resources/**/*',",
    ...runtimePackageFileGlobs.map((glob) => `    ${JSON.stringify(glob)},`),
    "    'package.json'",
    '  ],',
    '  win: {',
    "    icon: path.resolve(__dirname, 'resources', 'icon.ico'),",
    '    target: [',
    '      {',
    "        target: 'nsis',",
    "        arch: ['x64']",
    '      }',
    '    ]',
    '  },',
    '  nsis: {',
    '    oneClick: false,',
    '    perMachine: false,',
    '    runAfterFinish: false,',
    '    allowToChangeInstallationDirectory: true,',
    '    createDesktopShortcut: true,',
    '    createStartMenuShortcut: true,',
    "    shortcutName: 'QiuAI WorkOS',",
    "    include: path.resolve(__dirname, 'installer.nsh')",
    '  }',
    '};',
    ''
  ].join('\n')
);

await run(process.execPath, [
  electronBuilderCliPath,
  '--win',
  'nsis',
  '--x64',
  '--publish',
  'never',
  '--projectDir',
  stageDir,
  '--config',
  stageConfigPath
]);

const finalPackageDir = path.join(finalPackageRootDir, `v${appPackageJson.version}`);
await publishInstallerArtifacts(outputDir, finalPackageDir, appPackageJson.version);

console.log(`Packaged Windows installer at ${outputDir}`);
console.log(`Published Windows installer to ${finalPackageDir}`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appDir,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true'
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`electron-builder exited with code ${code ?? 'unknown'}`));
    });
  });
}

function normalizePackageVersion(version) {
  const normalizedVersion = String(version ?? '').trim().replace(/^[~^]/, '');
  if (!normalizedVersion) {
    throw new Error('Missing electron version in apps/pc-app/package.json');
  }

  return normalizedVersion;
}

async function publishInstallerArtifacts(sourceDir, targetDir, version) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const expectedFiles = new Set([
    `QiuAI WorkOS Setup ${version}.exe`,
    `QiuAI WorkOS Setup ${version}.exe.blockmap`
  ]);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !expectedFiles.has(entry.name)) {
      continue;
    }

    await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}
