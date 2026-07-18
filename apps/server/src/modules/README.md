# Server Modules

Each module should keep the same internal boundary:

- `domain`: entities, value objects, domain rules
- `application`: use cases and orchestration
- `infrastructure`: database, external services, adapters
- `interface`: HTTP controllers, DTOs, API boundary validation

Planned modules:

- identity
- kernel
- workspace
- commercial
- organization
- iam
- role
- task
- execution
- knowledge
- tool
- model
- governance
- marketplace
