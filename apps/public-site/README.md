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
- `SERVER_INTERNAL_BASE_URL` for server-side public-site access to the WorkOS API
- `WORKOS_PUBLIC_BASE_URL` for public desktop installer redirects
- `NEXT_PUBLIC_ADMIN_CONSOLE_URL`
- `GITHUB_TOKEN` only for legacy non-WorkOS download items that still point at GitHub Releases

## Downloads

The QiuAI WorkOS Windows client download is maintained from `admin-console` -> `desktop releases`.
The public site reads the latest published Windows stable desktop release from the WorkOS server and redirects downloads to the server-hosted installer.

Do not maintain a second Windows client package entry from the public-site download admin unless it is a non-WorkOS legacy resource.

## Production

The public site is built and started by the main WorkOS deployment script.

Expected domains:

- `qiuaihub.com`
- `www.qiuaihub.com`
