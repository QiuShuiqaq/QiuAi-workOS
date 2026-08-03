import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const appPackageJsonPath = path.join(appDir, 'package.json');
const distDir = path.join(appDir, 'dist');
const resourcesDir = path.join(appDir, 'resources');
const releaseDir = path.join(appDir, 'release');
const stageDir = path.join(releaseDir, 'installer-stage');
const outputDir = path.join(releaseDir, 'installers');
const stageNodeModulesDir = path.join(stageDir, 'node_modules');
const stageConfigPath = path.join(stageDir, 'electron-builder.config.cjs');
const stagePackageJsonPath = path.join(stageDir, 'package.json');

const electronBuilderCliPath = require.resolve('electron-builder/cli.js');
const electronPackageJsonPath = require.resolve('electron/package.json');
const electronDistDir = path.join(path.dirname(electronPackageJsonPath), 'dist');
const sqlJsEntryPath = require.resolve('sql.js/dist/sql-wasm.js');
const sqlJsPackageDir = path.dirname(path.dirname(sqlJsEntryPath));
const runtimePackageDescriptors = [
  { name: 'sql.js', packageDir: sqlJsPackageDir },
  { name: 'jszip', packageDir: resolvePackageDir('jszip') },
  { name: 'pdf-parse', packageDir: resolvePackageDir('pdf-parse') }
];

await ensureExists(distDir, 'build output directory');
await ensureExists(path.join(resourcesDir, 'icon.png'), 'desktop window icon');
await ensureExists(path.join(resourcesDir, 'icon.ico'), 'Windows app icon');
await ensureExists(electronDistDir, 'Electron runtime directory');
await ensureExists(electronBuilderCliPath, 'electron-builder CLI');
for (const runtimePackage of runtimePackageDescriptors) {
  await ensureExists(runtimePackage.packageDir, `${runtimePackage.name} package directory`);
}

const appPackageJson = JSON.parse(await readFile(appPackageJsonPath, 'utf8'));
const electronVersion = normalizePackageVersion(
  appPackageJson.devDependencies?.electron ?? appPackageJson.dependencies?.electron
);
const runtimeDependencies = Object.fromEntries(
  runtimePackageDescriptors.map((runtimePackage) => [
    runtimePackage.name,
    appPackageJson.dependencies?.[runtimePackage.name] ?? readPackageVersion(runtimePackage.packageDir)
  ])
);

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageNodeModulesDir, { recursive: true });
await cp(distDir, path.join(stageDir, 'dist'), { recursive: true });
await cp(resourcesDir, path.join(stageDir, 'resources'), { recursive: true });
for (const runtimePackage of runtimePackageDescriptors) {
  await cp(runtimePackage.packageDir, path.join(stageNodeModulesDir, runtimePackage.name), { recursive: true });
}

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
    "    'node_modules/sql.js/**/*',",
    "    'node_modules/jszip/**/*',",
    "    'node_modules/pdf-parse/**/*',",
    "    'package.json'",
    '  ],',
    '  win: {',
    "    icon: path.resolve(__dirname, 'resources', 'icon.ico'),",
    '    signAndEditExecutable: false,',
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
    '    allowToChangeInstallationDirectory: true,',
    '    createDesktopShortcut: true,',
    '    createStartMenuShortcut: true,',
    "    shortcutName: 'QiuAI WorkOS'",
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

console.log(`Packaged Windows installer at ${outputDir}`);

async function ensureExists(target, label) {
  try {
    await access(target);
  } catch {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

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

function resolvePackageDir(packageName) {
  return path.dirname(require.resolve(`${packageName}/package.json`));
}

function readPackageVersion(packageDir) {
  const packageJson = require(path.join(packageDir, 'package.json'));
  return packageJson.version;
}
