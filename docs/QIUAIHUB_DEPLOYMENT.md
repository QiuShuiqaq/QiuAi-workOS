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

WorkOS must use an independent database namespace:

```text
database: qiuai_workos
user: qiu_workos
host: 127.0.0.1
port: 5432
```

Do not reuse the existing `qiu_commerce_license_platform` database for WorkOS business tables.
If the current server database is named `qiuaihub_prod`, keep that database for the existing platform and create a separate WorkOS database.

The first persistence slice covers the platform kernel tables:

- accounts
- tenants
- workspaces
- workspace_members
- organizations
- departments
- plans
- entitlements
- subscriptions
- usage_meters

The current database-backed slices also include billing orders, payment transactions, role templates, role instances, tasks, task runs, artifacts, execution logs, and cost records.

## Database Bootstrap

On the ECS server, create a separate WorkOS database and user from the PostgreSQL administrator account:

```bash
sudo -iu postgres psql
```

Inside `psql`:

```sql
CREATE USER qiu_workos WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE qiuai_workos OWNER qiu_workos;
GRANT ALL PRIVILEGES ON DATABASE qiuai_workos TO qiu_workos;
\q
```

Then update `/opt/qiuai-workos/.env`:

```bash
NODE_ENV=production
WORKOS_DEPLOY_TARGET=alicloud-ecs
WORKOS_PERSISTENCE_MODE=database
DATABASE_URL=postgresql://qiu_workos:REPLACE_WITH_DB_PASSWORD@127.0.0.1:5432/qiuai_workos?schema=public
WORKOS_BOOTSTRAP_ADMIN_PASSWORD=REPLACE_WITH_ADMIN_LOGIN_PASSWORD
```

Apply schema migrations and seed the platform kernel:

```bash
cd /opt/qiuai-workos
set -a
source .env
set +a
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run build
npm run check:deploy
```

Verify database-backed kernel status:

```bash
curl http://127.0.0.1:4100/api/v1/kernel/status
curl http://127.0.0.1:4100/api/v1/commercial/plans
curl -sS -H 'content-type: application/json' \
  -d '{"workspaceId":"20000000-0000-4000-8000-000000000002","featureKey":"canCreateDepartment"}' \
  http://127.0.0.1:4100/api/v1/entitlements/check
curl http://127.0.0.1:4100/api/v1/workspaces/20000000-0000-4000-8000-000000000002/organization/overview
```

Expected:

- `kernel/status` returns `persistenceMode: "database"`
- `kernel/status` returns `databaseReady: true`
- `commercial/plans` returns seeded plans and entitlements
- `entitlements/check` returns `allowed: true` for enterprise department management
- `organization/overview` returns seeded departments and members
- `https://workos.qiuaihub.com/login` opens the login page
- `admin@qiuai.local` can sign in with the bootstrap password you set in `.env`

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

Current mock-backed WorkOS can start with `WORKOS_PERSISTENCE_MODE=mock`. After the WorkOS database is created and migrated, set `WORKOS_PERSISTENCE_MODE=database` and replace the `DATABASE_URL` password placeholder.

Start or reload the app:

```bash
chmod +x deploy/alicloud-ecs/start-pm2.sh
./deploy/alicloud-ecs/start-pm2.sh
```

`start-pm2.sh` loads `.env`, installs dependencies with `npm ci`, generates the Prisma client, runs migrations and seed when `WORKOS_PERSISTENCE_MODE=database`, builds the app, runs `npm run check:deploy`, and only then reloads PM2. Do not unset `DATABASE_URL` after switching to database mode.

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
set -a
source .env
set +a
npm run check:deploy
curl http://127.0.0.1:4100/api/v1/health
curl http://127.0.0.1:3100/api/v1/health
curl -I http://workos.qiuaihub.com
WORKOS_API_URL=http://127.0.0.1:4100 WORKOS_WEB_URL=http://127.0.0.1:3100 npm run check:smoke
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

WorkOS uses separate callback paths to avoid routing conflicts:

```text
https://workos.qiuaihub.com/api/v1/billing/alipay/notify
https://workos.qiuaihub.com/billing/alipay/return
```

Required production environment variables:

```bash
WORKOS_DEPLOY_TARGET=alicloud-ecs
WORKOS_PUBLIC_BASE_URL=https://workos.qiuaihub.com
PAYMENT_ALIPAY_APP_ID=REPLACE_IN_SERVER_ENV_ONLY
PAYMENT_ALIPAY_PRIVATE_KEY=REPLACE_IN_SERVER_ENV_ONLY
PAYMENT_ALIPAY_PUBLIC_KEY=REPLACE_IN_SERVER_ENV_ONLY
PAYMENT_ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do
PAYMENT_ALIPAY_NOTIFY_PATH=/api/v1/billing/alipay/notify
PAYMENT_ALIPAY_RETURN_PATH=/billing/alipay/return
PAYMENT_ALIPAY_KEY_TYPE=PKCS8
PAYMENT_ALIPAY_SELLER_ID=OPTIONAL_PID_VALIDATION
```

Production behavior:

- Online subscription prices are seeded from the production plan catalog: Basic ¥299/month or ¥2,990/year, Standard ¥599/month or ¥5,990/year, Professional ¥980/month or ¥9,800/year.
- Paid order amounts come from server-side plan prices. If a plan price is not configured, the web UI disables online payment for that plan and the API refuses paid orders.
- Paid order creation fails with `ALIPAY_NOT_CONFIGURED` if required keys are missing.
- Paid order creation returns `paymentUrl` when Alipay is configured.
- Alipay notify returns plain text `success` only after signature, app ID, seller ID, and amount validation.
- Paid notifications update `billing_orders`, `payment_transactions`, and the workspace subscription.

## Alipay Development Settings

支付宝开放平台控制台里，你现在最关键的是这一路径：

```text
应用详情 -> 开发设置 -> 开发信息 -> 接口加签方式（密钥/证书） -> 设置
```

当前这套代码走的是**普通公钥 / 密钥模式**，不是证书模式。  
原因很简单：后端已经按 `appId + 应用私钥 + 支付宝公钥` 这组配置接好了，当前不需要切到证书模式。

建议按下面填：

| 控制台项 | 该填什么 |
| --- | --- |
| 接口加签方式 | 普通公钥 / 密钥模式 |
| 应用公钥 | 用支付宝开放平台密钥工具生成后，填到控制台 |
| 应用私钥 | 只放在本项目服务器 `.env`，不要放前端 |
| 支付宝公钥 | 从支付宝控制台复制后，填到本项目服务器 `.env` |
| 应用 APPID | 填到 `PAYMENT_ALIPAY_APP_ID` |
| 服务器 IP 白名单 | 选填，先不配也可以；如果控制台强制要求，再加当前 ECS 公网出口 IP |

补充说明：

- 这个项目的支付回调地址不是你手工在控制台里拼的，而是代码通过订单参数注入的。
- 订单创建时会自动带上：
  - `https://workos.qiuaihub.com/api/v1/billing/alipay/notify`
  - `https://workos.qiuaihub.com/billing/alipay/return`
- `PAYMENT_ALIPAY_KEY_TYPE` 保持 `PKCS8`。
- `.env` 里的私钥必须是完整 PEM 内容，保留头尾行，换行可写成 `\n`。
- 如果你把控制台切成证书模式，当前后端就不能直接用现有配置，需要再做一轮代码适配。

### 这一页每一项怎么处理

| 控制台项 | 现在怎么配 | 说明 |
| --- | --- | --- |
| 接口加签方式 | 已设置，确认是“密钥”模式 | 当前后端按应用私钥 + 支付宝公钥工作，不走证书模式 |
| 接口内容加密方式 | 暂不设置 | 当前支付链路不依赖这项 |
| 服务器 IP 白名单 | 可选，先不配也可以 | 需要更强安全控制时再加 ECS 公网出口 IP |
| 应用网关 | 先留空 | 这项用于接收支付宝异步消息，不是当前 page pay 主链路必需项 |
| 支付宝网关地址 | 保持默认 | 当前代码已默认使用 `https://openapi.alipay.com/gateway.do` |
| 授权回调地址 | 先留空 | 当前支付链路不依赖用户授权回跳 |
| openid 配置管理 | 已启用即可 | 当前不需要额外改动 |
| 受限密钥 | 暂不设置 | 当前项目还没用到这类能力 |

After configuring Alipay, verify with a small real order:

```bash
curl https://workos.qiuaihub.com/api/v1/workspaces/20000000-0000-4000-8000-000000000002/billing/overview
```

Then create a small authenticated test order from the web session or with a cookie-backed `curl`, open `paymentUrl`, complete payment, and confirm the order changes to `PAID`.
