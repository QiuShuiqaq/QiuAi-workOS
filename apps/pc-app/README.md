# PC App

Electron desktop workbench for digital employees.

Responsibilities:

- install and upgrade role packages
- configure model providers and model profiles
- register tools and tool permissions
- bind local knowledge and assets
- run tasks locally
- inspect logs, artifacts, costs, and failures
- sync summaries back to the server

Initial direction:

- Reuse shared UI primitives where possible
- Keep desktop-specific shell code isolated
- Use shared `@qiuai/api-contract`, `@qiuai/domain`, and `@qiuai/ui`
- Do not duplicate entitlement logic in Electron or the renderer
