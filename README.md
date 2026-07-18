# QiuAI WorkOS

Enterprise Digital Workforce Platform.

This repository is structured as a TypeScript monorepo for the QiuAI WorkOS platform kernel, web console, Electron desktop client, and future mobile client.

## Local Tooling

Project tooling should stay inside this repository whenever possible.

- npm cache: `.local/npm-cache`
- npm logs: `.local/npm-logs`
- dependencies: local `node_modules/`

Do not use global npm installs for this project. Add required tools as workspace dev dependencies instead.

Run this before installing dependencies:

```bat
.\tools\npm-local.cmd run check:local-tooling
```

Use the wrapper for npm commands on Windows:

```bat
.\tools\npm-local.cmd install
.\tools\npm-local.cmd run dev:web
```

## Workspace Layout

- `apps/server`: main API server
- `apps/web-console`: Web console
- `apps/pc-app`: Electron desktop app
- `apps/mobile-app`: React Native / Expo mobile app
- `packages/domain`: shared domain types
- `packages/api-contract`: shared API contracts
- `packages/api-client`: shared API client
- `packages/ui`: QiuAI business UI components based on Ant Design
- `packages/design-tokens`: shared design tokens
- `services/execution-worker`: async execution worker placeholder
- `infra`: deployment and local infrastructure
- `tools`: project-local scripts
