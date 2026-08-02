# QiuAI WorkOS Public Site

This is the public product site for QiuAI WorkOS, served from the main `qiuai-workos` monorepo.

It contains public-facing pages only:

- Home
- Downloads
- Docs

It does not depend on PostgreSQL, Redis, Prisma, or the WorkOS runtime database.

## Local Development

```bash
npm run dev -w @qiuai/public-site
```

Open `http://127.0.0.1:3300`.

## Environment

Supported variables:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_ICP_BEIAN`
- `NEXT_PUBLIC_ICP_BEIAN_URL`
- `NEXT_PUBLIC_WORKOS_CONSOLE_URL`
- `NEXT_PUBLIC_ADMIN_CONSOLE_URL`
- `GITHUB_TOKEN` for GitHub Release download lookup

## Production

The public site is built and started by the main WorkOS deployment script.

Expected domains:

- `qiuaihub.com`
- `www.qiuaihub.com`
