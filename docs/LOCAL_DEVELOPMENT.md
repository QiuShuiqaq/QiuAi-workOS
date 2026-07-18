# QiuAI WorkOS 本地开发约束

## 本地化原则

项目工具、缓存、日志和依赖应尽量落在当前仓库目录下，避免默认写入系统盘用户目录。

当前约束：

- npm cache：`.local/npm-cache`
- npm logs：`.local/npm-logs`
- 依赖目录：仓库内 `node_modules`

`.local/` 不提交 Git。

## 安装前检查

执行：

```bat
.\tools\npm-local.cmd run check:local-tooling
```

如果输出 `OUTSIDE_REPO`，说明 npm 配置没有按项目 `.npmrc` 生效，需要先修正再安装依赖。

在 Windows 本地开发时，优先通过项目包装脚本执行 npm：

```bat
.\tools\npm-local.cmd install
.\tools\npm-local.cmd run dev:web
.\tools\npm-local.cmd run dev:server
```

这个脚本会在当前仓库内设置 npm cache 和 logs 目录，避免被用户级 npm 配置覆盖。

## 不建议的操作

不要在本项目里做 npm 全局安装。需要工具时，优先放入根目录 `devDependencies`，或者使用显式项目缓存执行。

不要把 Docker volume、数据库目录、上传文件目录写成 C 盘绝对路径。

后续所有本地服务配置应优先使用项目相对路径。

## Prisma

Prisma CLI 固定在 6.x 线，匹配当前 Node 20 基线。

常用命令：

```bat
.\tools\npm-local.cmd run prisma:generate -w @qiuai/server
.\tools\npm-local.cmd run prisma:migrate:dev -w @qiuai/server
.\tools\npm-local.cmd run prisma:studio -w @qiuai/server
```

本地迁移前先启动数据库：

```bat
.\tools\npm-local.cmd run infra:up
```
