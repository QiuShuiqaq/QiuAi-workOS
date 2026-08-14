#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/qiuai-workos}"

cd "${APP_DIR}"

echo "==> Cleaning stale Next.js build outputs"
rm -rf \
  apps/admin-console/.next \
  apps/web-console/.next \
  apps/public-site/.next

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
    echo "==> Syncing code-managed templates and asset definitions"
    npm run db:sync:catalogs
  fi
fi

echo "==> Building QiuAI WorkOS server deployment"
npm run build:deploy

echo "==> Checking deployment readiness"
npm run check:deploy

echo "==> Starting PM2 processes"
pm2 startOrReload deploy/alicloud-ecs/ecosystem.config.cjs --update-env
pm2 save
pm2 status
