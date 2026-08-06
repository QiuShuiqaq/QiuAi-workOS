import { existsSync, readFileSync } from 'node:fs';
import { access, cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const desktopRuntimeDependencyGroups = [
  {
    id: 'local-database',
    label: 'Local database runtime',
    packages: ['sql.js'],
    requiredFiles: ['node_modules/sql.js/dist/sql-wasm.wasm']
  },
  {
    id: 'office-document',
    label: 'Office document tools',
    toolIds: ['office-document'],
    packages: ['jszip', 'pdf-parse']
  },
  {
    id: 'video-processing',
    label: 'Video processing tools',
    toolIds: ['video-processing'],
    actions: ['video.probe', 'video.extract_audio', 'video.extract_frames', 'video.compose_clips'],
    packages: [
      '@ffmpeg-installer/ffmpeg',
      '@ffmpeg-installer/win32-x64',
      '@ffprobe-installer/ffprobe',
      '@ffprobe-installer/win32-x64'
    ],
    requiredFiles: [
      'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe',
      'node_modules/@ffprobe-installer/win32-x64/ffprobe.exe'
    ],
    requireChecks: ['@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe']
  }
];

export function getRuntimePackageDescriptors() {
  return getRuntimePackageNames().map((name) => ({
    name,
    packageDir: resolvePackageDir(name)
  }));
}

export function getRuntimePackageFileGlobs() {
  return getRuntimePackageNames().map((name) => `node_modules/${name}/**/*`);
}

export async function getRuntimePackageDependencies(appPackageJsonPath) {
  const appPackageJson = JSON.parse(await readFile(appPackageJsonPath, 'utf8'));
  const runtimePackageDescriptors = getRuntimePackageDescriptors();
  return Object.fromEntries(
    runtimePackageDescriptors.map((runtimePackage) => [
      runtimePackage.name,
      appPackageJson.dependencies?.[runtimePackage.name] ?? readPackageVersion(runtimePackage.packageDir)
    ])
  );
}

export async function ensureRuntimePackageSources() {
  const runtimePackageDescriptors = getRuntimePackageDescriptors();
  for (const runtimePackage of runtimePackageDescriptors) {
    await ensureExists(runtimePackage.packageDir, `${runtimePackage.name} package directory`);
  }
}

export async function copyRuntimePackages(targetNodeModulesDir) {
  const runtimePackageDescriptors = getRuntimePackageDescriptors();
  await mkdir(targetNodeModulesDir, { recursive: true });
  for (const runtimePackage of runtimePackageDescriptors) {
    const targetPackageDir = path.join(targetNodeModulesDir, runtimePackage.name);
    await mkdir(path.dirname(targetPackageDir), { recursive: true });
    await cp(runtimePackage.packageDir, targetPackageDir, { recursive: true });
  }
}

export function getRuntimeRequiredFiles() {
  return desktopRuntimeDependencyGroups.flatMap((group) => group.requiredFiles ?? []);
}

export function getRuntimeRequireChecks() {
  return desktopRuntimeDependencyGroups.flatMap((group) => group.requireChecks ?? []);
}

export async function ensureExists(target, label) {
  try {
    await access(target);
  } catch {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function getRuntimePackageNames() {
  return [
    ...new Set(
      desktopRuntimeDependencyGroups.flatMap((group) => group.packages)
    )
  ];
}

function resolvePackageDir(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    let currentDir = path.dirname(require.resolve(packageName));
    while (currentDir && currentDir !== path.dirname(currentDir)) {
      if (existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    throw new Error(`Unable to resolve package directory for ${packageName}`);
  }
}

function readPackageVersion(packageDir) {
  const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  return packageJson.version;
}
