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

  echo "==> Seeding database"
  npm run db:seed
fi

echo "==> Building QiuAI WorkOS"
npm run build

echo "==> Checking deployment readiness"
npm run check:deploy

echo "==> Starting PM2 processes"
pm2 startOrReload deploy/alicloud-ecs/ecosystem.config.cjs --update-env
pm2 save
pm2 status
