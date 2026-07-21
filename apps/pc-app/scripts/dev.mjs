import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const host = process.env.QIUAI_PC_DEV_HOST || '127.0.0.1';
const preferredPort = Number.parseInt(process.env.QIUAI_PC_DEV_PORT || '5173', 10);

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available dev port found from ${startPort} to ${startPort + 99}.`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
}

function start(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options
  });
}

function packageFile(packageName, relativePath) {
  return join(dirname(require.resolve(`${packageName}/package.json`)), relativePath);
}

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The renderer server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

const port = await findAvailablePort(Number.isFinite(preferredPort) ? preferredPort : 5173);
const devServerUrl = `http://${host}:${port}`;

if (port !== preferredPort) {
  console.log(`Port ${preferredPort} is busy. Using ${port} for the PC dev server.`);
}

if (process.env.QIUAI_PC_DEV_DRY_RUN === '1') {
  console.log(`QIUAI_PC_DEV_SERVER_URL=${devServerUrl}`);
  process.exit(0);
}

rmSync('dist', { recursive: true, force: true });
await run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.json']);

const viteProcess = start(process.execPath, [
  packageFile('vite', 'bin/vite.js'),
  '--host',
  host,
  '--port',
  String(port),
  '--strictPort'
]);

let shuttingDown = false;

function stopChildren() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  viteProcess.kill();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopChildren();
    process.kill(process.pid, signal);
  });
}

viteProcess.once('exit', (code, signal) => {
  if (!shuttingDown) {
    console.error(`Renderer dev server exited with ${signal || code}.`);
    process.exit(code ?? 1);
  }
});

await waitForUrl(devServerUrl);

const electronEnv = {
  ...process.env,
  QIUAI_PC_DEV_SERVER_URL: devServerUrl
};
delete electronEnv.ELECTRON_RUN_AS_NODE;

const electronProcess = start(require('electron'), ['.'], {
  env: electronEnv
});

electronProcess.once('error', (error) => {
  console.error(error);
  stopChildren();
  process.exit(1);
});

electronProcess.once('exit', (code, signal) => {
  stopChildren();
  process.exit(code ?? (signal ? 1 : 0));
});
