#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/qiuai-workos}"

cd "${APP_DIR}"

if [[ -f ".env" ]]; then
  echo "==> Loading .env"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "Missing .env in ${APP_DIR}" >&2
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npm run db:generate

if [[ "${WORKOS_PERSISTENCE_MODE:-mock}" == "database" ]]; then
  echo "==> Applying database migrations"
  npm run db:migrate:deploy

  if [[ "${WORKOS_RUN_FULL_SEED:-false}" == "true" ]]; then
    echo "==> Running full database seed (explicit bootstrap mode)"
    npm run db:seed
  else
    echo "==> Syncing code-managed plans, templates, assets, and official model routes"
    npm run db:sync:managed-production
  fi
fi

echo "==> Building QiuAI WorkOS server deployment"
npm run build:deploy

echo "==> Checking deployment readiness"
npm run check:deploy

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is required to start the production processes" >&2
  exit 1
fi

echo "==> Starting or reloading PM2 processes"
pm2 startOrReload deploy/alicloud-ecs/ecosystem.config.cjs --update-env
pm2 save
sleep 3
pm2 status

echo "==> Checking local service ports"
curl -fsS http://127.0.0.1:4100/api/v1/health >/dev/null
curl -fsS http://127.0.0.1:3100/login >/dev/null
curl -fsS http://127.0.0.1:3200/login >/dev/null
curl -fsS http://127.0.0.1:3300/ >/dev/null
echo "local service ports: OK"
