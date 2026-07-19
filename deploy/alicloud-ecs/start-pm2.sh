#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/qiuai-workos}"

cd "${APP_DIR}"

echo "==> Clearing shell-level database variables"
unset DATABASE_URL
unset REDIS_URL

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npm run prisma:generate -w @qiuai/server

echo "==> Building QiuAI WorkOS"
npm run build

echo "==> Starting PM2 processes"
pm2 startOrReload deploy/alicloud-ecs/ecosystem.config.cjs --update-env
pm2 save
pm2 status
