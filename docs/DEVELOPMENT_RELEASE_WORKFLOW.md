# Development And Release Workflow

## Environment Boundary

| Environment | Branch | Runtime | Purpose |
| --- | --- | --- | --- |
| Local development | `dev` | Windows workstation, Docker Desktop, `127.0.0.1` services | Build and test unfinished work safely. |
| Production | `main` | ECS server and released Windows installer | Serve enterprise users. |

The production server must only pull `main`. Never deploy a `dev` commit directly to the server.

## Local Development

Source code remains in:

```text
F:\Workspace_VS\QiuAi-workOS
```

Local-only runtime state remains in:

```text
F:\Dev\projects\qiuai-workos
  runtime\       PostgreSQL and Redis Docker data
  logs\          Local API, web, admin, and desktop logs
  npm-logs\      npm logs
  pc-user-data\  Electron development runtime state
```

Release installers remain in:

```text
F:\Package\QiuAI-workOS\v<version>\
```

Do not commit `.env`, `F:\Dev`, installers, build output, local databases, logs, or local model credentials.

### Start Local Services

Start Docker Desktop first. In PowerShell:

```powershell
cd F:\Workspace_VS\QiuAi-workOS
.\local-dev\start-local-dev.cmd -Desktop
```

The local launcher starts PostgreSQL, Redis, API, web-console, admin-console, and the PC desktop client. It sets `WORKOS_LOCAL_DEV_UNLIMITED=true` only for the local loopback API, so all published digital employees and digital factories can be installed for testing.

For a first-time local database, run once:

```powershell
.\local-dev\start-local-dev.cmd -Bootstrap
```

For daily startup after that, do not use `-Bootstrap`; it would intentionally reset seed-managed local test data.

Stop local processes with:

```powershell
.\local-dev\stop-local-dev.cmd
```

Use `-DownInfra` only when PostgreSQL and Redis should also stop.

## Daily Development Flow

1. Confirm the current branch is `dev`.
2. Start the local environment and test only against `127.0.0.1` services.
3. Implement and test the change locally. New digital employee or factory templates require new stable IDs and must not change old templates unless that update is intentional.
4. Run focused tests, then commit and push to `dev`.
5. Do not update the production server for a `dev` push.

## Release Flow

1. Review the completed work on `dev` and run local regression tests.
2. Merge `dev` into `main` only when it is suitable for real users.
3. Push `main` to GitHub.
4. Update the ECS server from `main` using the documented deployment command.
5. Verify production API, web-console, and admin-console before packaging.
6. Check out the same `main` commit locally and build the Windows installer.
7. Put the verified installer under `F:\Package\QiuAI-workOS\v<version>\` and publish it through the admin download management flow.

## Release Gate

Before merging `dev` into `main`, verify:

- Existing digital employees and digital factories still install and run.
- Existing model slot bindings remain compatible.
- The local PC app can configure a model, start a task, and inspect/download its output.
- API, web-console, and admin-console tests relevant to the change pass.
- Database migrations run locally.
- No local `.env`, API key, user data, package, log, or build directory is staged for commit.

## Production Safeguards

`WORKOS_LOCAL_DEV_UNLIMITED` is not a product entitlement. It is valid only for a local API that meets all of these conditions:

- `NODE_ENV=development`
- `APP_ENV=local`
- `WORKOS_DEPLOY_TARGET=local`
- `SERVER_HOST` is `127.0.0.1`, `localhost`, or `::1`
- `WORKOS_LOCAL_DEV_UNLIMITED=true`

Production must keep the flag unset or `false`. The production server still applies subscriptions, template authorization, device tokens, and capacity limits.
