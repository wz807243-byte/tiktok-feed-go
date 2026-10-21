# 短视频前端

Vue 3 + TypeScript + Vite + Pinia，源码位于 D:/feedsystem-go/frontend，与 ../backend 同属一个项目。

## 本地开发

在仓库根目录运行 docker compose up -d 启动后端，再执行 docker compose stop frontend 释放本地开发端口，然后运行：

```powershell
cd D:/feedsystem-go/frontend
npm ci
# 首次配置时复制；当前本机已保留 .env.local，无需覆盖。
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

打开 http://127.0.0.1:30080 。前端默认真实接口，Docker 后端代理目标为 http://127.0.0.1:18080。
本机直接运行 Go 时，将 .env.local 的 VITE_API_TARGET 改为 http://127.0.0.1:8080。
如需调整页面端口，修改 VITE_DEV_PORT 并重启开发服务。环境文件不提交到 Git。

## 可用页面与验证

- /feed：推荐、关注视频流，点赞、评论、关注与分享。
- /hot：热度榜，支持排名、刷新、分页和点击播放；按真实后端顺序展示，不伪造热度分。
- /friends、/me、/messages、/chat/:peerId、/publish、/login：好友、资料、私信、发布及登录注册。
- 搜索、收藏尚未开放；私信需要手动刷新。
- 后端继续使用原有异步点赞和关注流缓存方式，相应已知问题由后端单独维护。

```powershell
npm run typecheck
npm test
npm run build
```

Mock 需显式设置 VITE_USE_MOCK=true；Mock 和真实模式登录凭证分开存储。

## 代理与部署

开发及 preview 服务代理 /api 和 /static；/api 转发时去掉前缀。
Dockerfile 使用 Node 构建、Nginx 提供 dist/。在仓库根目录运行 docker compose up -d --build，即可统一启动前端、后端和依赖服务。
首次使用时先运行 docker volume create feedsystem-go_media_data；已有媒体卷会保留。
Docker 网页地址为 http://127.0.0.1:30080，端口通过根目录 .env 的 FRONTEND_PORT 配置。
生产环境强制使用真实接口与同源 /api；不会复制本机 .env.local、node_modules 或 dist 到构建上下文。
Nginx 将 /api 去前缀后转发至 backend:8080，/static 保留路径转发，支持视频 Range 请求、220 MiB 请求体及 SPA 刷新。
修改前端后运行 docker compose up -d --build --no-deps frontend；此操作保留已有数据卷。

当前 Windows 将 5566 划入保留端口，本地开发端口使用 30080。历史上传文件的本机绝对地址通过同源 /static 代理读取，迁移或更换端口后仍可访问。
