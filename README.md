# feed-go

## 项目目录

- backend/：Go API、worker 与后端配置。
- frontend/：Vue 3 + TypeScript 前端，含推荐、关注、热度榜、发布、个人页和私信。

## Docker 统一启动

安装并打开 Docker Desktop，在项目根目录运行：

```powershell
cd D:/feedsystem-go
# 首次配置时可复制 .env.example 为 .env，已有配置请保留。
# 外部媒体卷独立保存上传文件；创建命令可重复执行，不清空已有文件。
docker volume create feedsystem-go_media_data
docker compose up -d --build
```

网页：http://127.0.0.1:30080 ，热度榜：http://127.0.0.1:30080/hot 。
API 调试地址：http://127.0.0.1:18080 。前端通过同源 /api 和 /static 代理访问后端。
Compose 一并管理 frontend、backend、worker、MySQL、Redis 和 RabbitMQ，并按健康检查顺序启动。
网页端口可在根目录 .env 中设置 FRONTEND_PORT，默认 30080。

```powershell
docker compose ps
docker compose logs --tail=100 frontend backend worker
# 修改前端源码后，只重新构建前端：
docker compose up -d --build --no-deps frontend
# 暂停整个项目，保留容器和数据：
docker compose stop
# 再次启动已构建的项目：
docker compose up -d
```

数据库、缓存、消息和上传媒体使用持久化卷。保留现有卷即可保留账号和测试视频；不要使用 docker compose down -v 删除数据卷。
前端镜像执行类型检查、测试和生产构建，由 Nginx 提供页面、SPA 路由回退及接口/视频代理。

## 前端本地开发

Docker 前端与 Vite 默认都使用 30080；本地开发前先停止 Docker 前端，后端可以继续运行。

```powershell
cd D:/feedsystem-go
docker compose stop frontend
cd frontend
npm ci
# 首次使用时创建本地配置，当前本机已有则保留。
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

访问 http://127.0.0.1:30080 。本地配置使用 VITE_API_TARGET=http://127.0.0.1:18080。
也可修改 frontend/.env.local 中的 VITE_DEV_PORT，让 Vite 和 Docker 前端使用不同端口。
验证命令：npm run typecheck、npm test、npm run build。
更多说明见 frontend/README.md。
