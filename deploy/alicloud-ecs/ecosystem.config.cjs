module.exports = {
  apps: [
    {
      name: 'qiuai-workos-server',
      cwd: '/opt/qiuai-workos',
      script: 'apps/server/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: '4100'
      }
    },
    {
      name: 'qiuai-workos-web',
      cwd: '/opt/qiuai-workos',
      script: 'node_modules/next/dist/bin/next',
      args: 'start apps/web-console --hostname 127.0.0.1 --port 3100',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SERVER_API_BASE_URL: 'http://127.0.0.1:4100',
        SERVER_INTERNAL_BASE_URL: 'http://127.0.0.1:4100',
        NEXT_PUBLIC_API_BASE_URL: ''
      }
    },
    {
      name: 'qiuai-workos-admin',
      cwd: '/opt/qiuai-workos',
      script: 'node_modules/next/dist/bin/next',
      args: 'start apps/admin-console --hostname 127.0.0.1 --port 3200',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SERVER_API_BASE_URL: 'http://127.0.0.1:4100',
        SERVER_INTERNAL_BASE_URL: 'http://127.0.0.1:4100',
        NEXT_PUBLIC_API_BASE_URL: ''
      }
    }
  ]
};
