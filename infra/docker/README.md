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
