import { accessSync } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  getRuntimePackageDescriptors,
  getRuntimeRequiredFiles,
  getRuntimeRequireChecks
} from './runtime-dependencies.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const targets = [
  {
    key: 'installer',
    label: 'Windows installer unpacked app',
    appRoot: path.join(appDir, 'release', 'installers', 'win-unpacked', 'resources', 'app')
  },
  {
    key: 'portable',
    label: 'Portable app bundle',
    appRoot: path.join(appDir, 'release', 'pc-app')
  }
];

const requestedTargets = readRequestedTargets();
const selectedTargets = targets.filter((target) => requestedTargets.includes(target.key));
if (selectedTargets.length === 0) {
  throw new Error(`No package target selected. Expected one of: ${targets.map((target) => `--${target.key}`).join(', ')}`);
}

for (const target of selectedTargets) {
  await checkPackagedApp(target);
}

console.log(`Runtime dependency check passed for: ${selectedTargets.map((target) => target.key).join(', ')}`);

function readRequestedTargets() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--installer')) return ['installer'];
  if (args.has('--portable')) return ['portable'];
  if (args.has('--all')) return targets.map((target) => target.key);
  return targets.map((target) => target.key).filter((key) => {
    const target = targets.find((item) => item.key === key);
    return target ? fileExistsSync(target.appRoot) : false;
  });
}

async function checkPackagedApp(target) {
  await ensureExists(target.appRoot, `${target.label} root`);
  await ensureExists(path.join(target.appRoot, 'package.json'), `${target.label} package.json`);

  for (const runtimePackage of getRuntimePackageDescriptors()) {
    await ensureExists(
      path.join(target.appRoot, 'node_modules', runtimePackage.name, 'package.json'),
      `${target.label} runtime package ${runtimePackage.name}`
    );
  }

  for (const relativePath of getRuntimeRequiredFiles()) {
    const requiredFilePath = path.join(target.appRoot, relativePath);
    await ensureNonEmptyFile(requiredFilePath, `${target.label} required runtime file ${relativePath}`);
  }

  const packagedRequire = createRequire(path.join(target.appRoot, 'package.json'));
  for (const packageName of getRuntimeRequireChecks()) {
    const packageExports = packagedRequire(packageName);
    const binaryPath = readPackageBinaryPath(packageExports);
    await ensureNonEmptyFile(binaryPath, `${target.label} ${packageName} binary`);
    if (!path.resolve(binaryPath).startsWith(path.resolve(target.appRoot))) {
      throw new Error(`${target.label} ${packageName} resolved outside packaged app: ${binaryPath}`);
    }
  }
}

async function ensureExists(target, label) {
  try {
    await access(target);
  } catch {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

async function ensureNonEmptyFile(target, label) {
  await ensureExists(target, label);
  const stats = await stat(target);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Invalid ${label}: ${target}`);
  }
}

function readPackageBinaryPath(packageExports) {
  if (!packageExports || typeof packageExports !== 'object' || typeof packageExports.path !== 'string') {
    throw new Error('Runtime binary package did not expose a path field.');
  }

  return packageExports.path;
}

function fileExistsSync(target) {
  try {
    accessSync(target);
    return true;
  } catch {
    return false;
  }
}
