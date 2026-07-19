# Docker

Local Docker assets will live here.

Do not add host-specific absolute paths. Use project-relative paths so the repository can move between machines and later connect to GitHub cleanly.

## Local Services

From the repository root:

```bash
npm run infra:up
npm run infra:down
```

Local data is stored under `.local/docker/`.

## Full Deployment Stack

`compose.deploy.yml` starts the Web console, API server, PostgreSQL, and Redis:

```bash
npm run check:deploy
docker compose -f infra/docker/compose.deploy.yml up -d --build
docker compose -f infra/docker/compose.deploy.yml ps
```

Project scripts:

```bash
npm run deploy:up
npm run deploy:logs
npm run deploy:down
```

The Web console proxies browser requests from `/api/v1` to the API server through `SERVER_INTERNAL_BASE_URL`.
See `docs/SERVER_DEPLOYMENT.md` for server deployment steps.

For the existing qiuaihub.com ECS host, use `docs/QIUAIHUB_DEPLOYMENT.md` instead of the Docker Compose route.
