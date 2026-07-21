import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const host = process.env.QIUAI_PC_DEV_HOST || '127.0.0.1';
const preferredPort = Number.parseInt(process.env.QIUAI_PC_DEV_PORT || '5173', 10);

function commandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

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
      shell: process.platform === 'win32',
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

const port = await findAvailablePort(Number.isFinite(preferredPort) ? preferredPort : 5173);
const devServerUrl = `http://${host}:${port}`;

if (port !== preferredPort) {
  console.log(`Port ${preferredPort} is busy. Using ${port} for the PC dev server.`);
}

if (process.env.QIUAI_PC_DEV_DRY_RUN === '1') {
  console.log(`QIUAI_PC_DEV_SERVER_URL=${devServerUrl}`);
  process.exit(0);
}

await run(commandName('npm'), ['run', 'build:electron']);

const concurrently = spawn(
  commandName('concurrently'),
  [
    '-k',
    '-n',
    'renderer,electron',
    `vite --host ${host} --port ${port} --strictPort`,
    `wait-on ${devServerUrl} && cross-env QIUAI_PC_DEV_SERVER_URL=${devServerUrl} electron .`
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      QIUAI_PC_DEV_SERVER_URL: devServerUrl
    }
  }
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    concurrently.kill(signal);
  });
}

concurrently.once('error', (error) => {
  console.error(error);
  process.exit(1);
});

concurrently.once('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
