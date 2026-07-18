import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const composeFile = path.resolve(root, 'infra/docker/compose.deploy.yml');

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

try {
  console.log(`docker-cli: ${run('docker', ['--version'])}`);
} catch {
  fail('Docker CLI is not available in PATH.');
}

try {
  run('docker', ['compose', '-f', composeFile, 'config']);
  console.log('compose-config: OK');
} catch {
  fail('Docker Compose configuration is invalid.');
}

try {
  console.log(`docker-daemon: ${run('docker', ['info', '--format', '{{.Server.Version}}'])}`);
} catch (error) {
  fail(
    'Docker daemon is not running.',
    'Start Docker Desktop or the Docker service, then rerun `npm run check:deploy`.'
  );
}

console.log('Deployment readiness checks passed.');
