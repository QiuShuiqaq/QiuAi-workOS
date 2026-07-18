# QiuAI WorkOS 服务器部署说明

## 部署目标

这一阶段的部署目标是让 Web 控制台和 API 服务可以在同一台服务器上通过 Docker Compose 启动，并验证：

- 浏览器可以打开 Web 控制台。
- Web 控制台可以通过同源 `/api/v1` 代理访问后端。
- 后端健康检查可访问。
- PostgreSQL 和 Redis 容器已预留，后续切换真实持久化时不需要重做部署拓扑。

当前业务数据仍由 mock store 提供；数据库容器已经纳入部署，但核心数据持久化会在下一阶段接入。

## 架构路径

```text
Browser
  -> http://server:3000
  -> Web Console /api/v1 proxy
  -> http://server:4000/api/v1
  -> NestJS API Server
```

前端浏览器默认不直接访问 `http://server:4000`，而是访问 Web 同源路径 `/api/v1`。这样后续上域名和 HTTPS 时，只需要把 Web 暴露出去，后端可以留在内网或容器网络中。

## 服务器准备

服务器需要：

- Git
- Docker Engine
- Docker Compose v2+
- 可以访问 GitHub SSH 仓库
- 开放 Web 访问端口，默认 `3000`

生产环境建议最终用 Nginx 或 Caddy 把域名的 `80/443` 代理到 Web 容器的 `3000`，不要把数据库端口暴露到公网。

## 首次部署

在服务器上执行：

```bash
git clone git@github.com:QiuShuiqaq/QiuAi-workOS.git
cd QiuAi-workOS
cp .env.example .env
```

编辑 `.env`，至少改掉：

```bash
POSTGRES_PASSWORD=replace_with_strong_password
```

启动完整部署栈：

```bash
docker compose -f infra/docker/compose.deploy.yml up -d --build
```

或在本地 Windows 仓库中使用项目脚本：

```bat
.\tools\npm-local.cmd run deploy:up
```

## 联通性检查

服务启动后检查：

```bash
docker compose -f infra/docker/compose.deploy.yml ps
curl http://127.0.0.1:4000/api/v1/health
curl http://127.0.0.1:3000/api/v1/health
curl http://127.0.0.1:3000
```

判断标准：

- `4000/api/v1/health` 返回后端健康状态。
- `3000/api/v1/health` 返回同样的后端健康状态，说明 Web 代理已经联通后端。
- `3000` 返回 Web 控制台 HTML。

浏览器打开：

```text
http://服务器IP:3000
```

进入 `任务中心`，创建一个任务，再进入任务详情点击 `Mock 执行`。如果能看到产物、日志和成本记录，说明浏览器客户端、Web 控制台和后端 API 已经联通。

## 常用命令

```bash
docker compose -f infra/docker/compose.deploy.yml logs -f --tail=100
docker compose -f infra/docker/compose.deploy.yml restart server
docker compose -f infra/docker/compose.deploy.yml restart web
docker compose -f infra/docker/compose.deploy.yml down
```

Windows 本地脚本：

```bat
.\tools\npm-local.cmd run deploy:logs
.\tools\npm-local.cmd run deploy:down
```

## 重要环境变量

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `WEB_PUBLISHED_PORT` | Web 对宿主机暴露端口 | `3000` |
| `SERVER_PUBLISHED_PORT` | API 对宿主机暴露端口 | `4000` |
| `SERVER_API_BASE_URL` | Web 服务端渲染访问后端的地址 | `http://server:4000` |
| `SERVER_INTERNAL_BASE_URL` | Web `/api/v1` 代理访问后端的地址 | `http://server:4000` |
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器 API 源地址前缀，不要重复填写 `/api/v1` | 留空，默认走同源 Web 代理 |
| `SERVER_DATABASE_URL` | 可选，覆盖服务端容器的 PostgreSQL 连接串 | 留空，默认由 `POSTGRES_*` 生成 |
| `SERVER_REDIS_URL` | 可选，覆盖服务端容器的 Redis 连接串 | 留空，默认 `redis://redis:6379/0` |
| `DATABASE_URL` | 本机 Prisma/数据库命令连接串 | 本机 PostgreSQL |
| `REDIS_URL` | 本机 Redis 连接串 | 本机 Redis |

除非明确要让浏览器绕过 Web 代理，否则不要设置 `NEXT_PUBLIC_API_BASE_URL`。如果要设置，只填写源地址，例如 `https://api.example.com`，不要写成 `https://api.example.com/api/v1`。

## 当前限制

- 认证、权限和真实数据库持久化还没有接入。
- PostgreSQL 和 Redis 已经部署，但当前第一版业务闭环仍使用 mock store。
- `4000` 端口现在为了调试方便暴露到宿主机；正式上线时建议只保留 Web 对公网开放，由反向代理或内网访问后端。
