# QiuAI WorkOS on qiuaihub.com

## Source Project Findings

`F:\Workspace_VS\QiuAi\qiuai-platform` is a separate Next.js commercial platform project. Its deployment assets show:

- Domain: `qiuaihub.com`
- Existing deployment style: Alibaba Cloud ECS, PM2, Nginx, PostgreSQL
- Current production subdomains: `api.qiuaihub.com` and `admin.qiuaihub.com`
- Existing app path: `/opt/qiuai-platform`
- Existing app port: `127.0.0.1:3001`
- Existing PM2 processes: `qiu-commerce-license-platform` and `qiu-generation-worker`
- Existing PostgreSQL endpoint: `127.0.0.1:5432`
- Existing Redis endpoint: `127.0.0.1:6379`
- Existing public payment callbacks: `https://qiuaihub.com/api/payment/alipay/notify` and `https://qiuaihub.com/payment/alipay/return`
- Local `.env.local` only contains local preview values, not production database or Alipay secrets

Do not copy secrets from that project into this repository. Keep QiuAI WorkOS independent at the process, port, database, and callback-path levels.

## Recommended Production Shape

Use the same ECS host and qiuaihub.com domain ownership, but deploy WorkOS as an independent service:

```text
Browser
  -> https://workos.qiuaihub.com
  -> Nginx
  -> 127.0.0.1:3100 QiuAI WorkOS Web
  -> same-origin /api/v1 proxy
  -> 127.0.0.1:4100 QiuAI WorkOS API
```

This avoids collisions with the existing platform's `/api/*` routes on `qiuaihub.com`.

## Ports

- Existing qiuai-platform: keep its current port unchanged.
- Existing qiuai-platform current baseline: `127.0.0.1:3001`
- WorkOS Web: `127.0.0.1:3100`
- WorkOS API: `127.0.0.1:4100`
- Public ports: only `80` and `443` through Nginx

## Database Policy

The first WorkOS skeleton still uses mock business data, but the database landing plan should be independent:

```text
database: qiuai_workos
user: qiu_workos
host: 127.0.0.1
port: 5432
```

Do not reuse the existing `qiu_commerce_license_platform` database for WorkOS business tables.
If the current server database is named `qiuaihub_prod`, keep that database for the existing platform and create a separate WorkOS database.

## Server Deployment

On the ECS server:

```bash
sudo mkdir -p /opt/qiuai-workos
sudo chown -R "$USER:$USER" /opt/qiuai-workos
git clone git@github.com:QiuShuiqaq/QiuAi-workOS.git /opt/qiuai-workos
cd /opt/qiuai-workos
cp deploy/alicloud-ecs/env.qiuaihub.example .env
vim .env
```

At minimum, replace future database/password placeholders before persistence is enabled. Current mock-backed WorkOS can start without using PostgreSQL.

Start the app:

```bash
unset DATABASE_URL
unset REDIS_URL
chmod +x deploy/alicloud-ecs/start-pm2.sh
./deploy/alicloud-ecs/start-pm2.sh
```

Install Nginx config:

```bash
sudo cp deploy/alicloud-ecs/nginx.workos.conf /etc/nginx/conf.d/qiuai-workos.conf
sudo nginx -t
sudo systemctl reload nginx
```

Then add DNS:

```text
workos.qiuaihub.com -> ECS public IP
```

For HTTPS, request a certificate for `workos.qiuaihub.com` with the same Certbot flow already used by the existing platform.

## Connectivity Checks

On the server:

```bash
curl http://127.0.0.1:4100/api/v1/health
curl http://127.0.0.1:3100/api/v1/health
curl -I http://workos.qiuaihub.com
```

Expected:

- API health returns `ok`
- Web `/api/v1/health` returns the same API health through the same-origin proxy
- `workos.qiuaihub.com` returns Web HTML

Browser check:

```text
https://workos.qiuaihub.com/enterprise?workspaceId=enterprise
```

## Alipay Boundary

The existing platform already owns:

```text
https://qiuaihub.com/api/payment/alipay/notify
https://qiuaihub.com/payment/alipay/return
```

When WorkOS billing is implemented, use separate callback paths to avoid routing conflicts:

```text
https://workos.qiuaihub.com/api/v1/billing/alipay/notify
https://workos.qiuaihub.com/billing/alipay/return
```

The current first-version WorkOS skeleton does not process real payments yet.
