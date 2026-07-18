import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

function npmConfigEnv(key) {
  const normalized = key.replaceAll('-', '_');
  return process.env[`npm_config_${normalized}`] ?? process.env[`NPM_CONFIG_${normalized.toUpperCase()}`];
}

function isInsideRepo(value) {
  if (!value || value === 'undefined' || value === 'null') {
    return false;
  }

  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

const checks = [
  ['cache', npmConfigEnv('cache')],
  ['logs-dir', npmConfigEnv('logs-dir')]
];

let failed = false;

for (const [key, value] of checks) {
  const ok = isInsideRepo(value);
  console.log(`${key}: ${value} ${ok ? 'OK' : 'OUTSIDE_REPO'}`);
  failed ||= !ok;
}

if (failed) {
  console.error('npm local tooling paths must stay inside this repository.');
  process.exit(1);
}

console.log('Local tooling paths are project-scoped.');
