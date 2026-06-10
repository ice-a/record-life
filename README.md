# RE Save

一个带密码入口的记录管理工具。前端使用 React + Vite + shadcn/ui，服务端负责 MongoDB、AI、网页提取、图片图床、SMTP 邮件和 Bark 通知。

## 功能

- 输入访问密码后进入工作台
- 按分类管理记录，可设置优先级、URL、标签、原始内容和 Markdown
- 独立维护多个 AI 配置，支持 OpenAI 兼容的 `/chat/completions` 接口
- 使用 AI 整理已有记录内容
- 输入网页 URL 后提取正文，用 AI 总结成 Markdown，并生成标签写入数据库
- 图片上传到公共图床，返回 URL 并写入记录
- 管理通知用户：邮箱、分组、Bark 地址、Bark token
- 按当天记录生成日报，可发送给数据库联系人、手动追加邮箱、指定分组，也可同时推送 Bark
- 可配置每日定时邮件任务
- 单条记录可生成公开分享链接，分享时可设置访问密码
- 可在“分享”页查看和删除所有已分享内容
- 网页总结、AI 整理和日报发送使用异步任务队列执行，适合 Vercel Functions

## 环境变量

复制 `.env.example` 为 `.env`，然后按需修改。

```env
# MongoDB 连接地址；本地开发一般使用 127.0.0.1。
MONGODB_URI=mongodb://127.0.0.1:27017
# MongoDB 数据库名称。
MONGODB_DB=re_save
# 进入应用时输入的访问密码。
APP_PASSWORD=change-this-password
# 会话签名密钥；生产环境请使用足够长的随机字符串。
SESSION_SECRET=change-this-secret
# API 服务监听端口，Vite 开发代理会转发到这个端口。
PORT=3001
# 定时任务使用的时区。
APP_TIMEZONE=Asia/Shanghai

# SMTP 服务器地址；为空时不能发送邮件。
SMTP_HOST=
# SMTP 服务器端口，常用 587 或 465。
SMTP_PORT=587
# 是否使用 SSL/TLS 直连；465 通常为 true，587 通常为 false。
SMTP_SECURE=false
# SMTP 登录用户名。
SMTP_USER=
# SMTP 登录密码或授权码。
SMTP_PASS=
# 邮件发件人；为空时默认使用 SMTP_USER。
SMTP_FROM=

# 是否启用每日定时邮件任务。
DAILY_EMAIL_ENABLED=false
# 每日邮件任务的 cron 表达式，按 APP_TIMEZONE 执行。
DAILY_EMAIL_CRON=0 20 * * *
# 每日邮件发送到指定联系人分组；为空表示全部启用的联系人。
DAILY_EMAIL_GROUP=
# 每日邮件额外收件人，多个邮箱用逗号分隔。
DAILY_EMAIL_EXTRA_RECIPIENTS=
# 每日邮件只整理指定分类；为空表示全部分类。
DAILY_EMAIL_CATEGORY_ID=
# 每日邮件使用的 AI 配置 ID；为空时使用默认整理逻辑。
DAILY_EMAIL_AI_CONFIG_ID=
# 每日邮件任务是否同时发送 Bark 通知。
DAILY_BARK_ENABLED=true

# 定时任务和队列接口的访问密钥。
CRON_SECRET=change-this-cron-secret
# 每次队列执行最多处理的任务数量。
JOB_RUN_LIMIT=2
# 单个任务失败后的最大尝试次数。
JOB_MAX_ATTEMPTS=3
# 任务锁定时间，单位毫秒，防止重复执行。
JOB_LOCK_MS=240000
# 本地内置队列 runner 的执行间隔，单位毫秒；设置为 0 可关闭。
LOCAL_JOB_RUNNER_INTERVAL_MS=30000

# Bark 默认服务地址，联系人未单独配置时使用。
BARK_DEFAULT_BASE_URL=https://api.day.app
# CloudFlare ImgBed 上传接口地址。
IMAGE_UPLOAD_ENDPOINT=https://img.example.com/upload
# CloudFlare ImgBed 访问密码，对应上传接口的 authCode。
IMAGE_UPLOAD_AUTH_CODE=change-this-image-auth-code
# 图床公开访问域名，用于补全相对路径返回值。
IMAGE_UPLOAD_PUBLIC_BASE_URL=https://img.example.com
# 单张图片最大上传体积，单位字节。
IMAGE_MAX_BYTES=4194304
# 抓取网页正文的超时时间，单位毫秒。
WEB_FETCH_TIMEOUT_MS=10000
```

正式使用前请复制示例环境变量文件，并设置自己的 `APP_PASSWORD` 和 `SESSION_SECRET`。

## 运行

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173
```

生产构建：

```bash
npm run build
npm start
```

## 本地生产部署

### 方式一：Docker Compose

推荐使用 Docker Compose，本地会同时启动应用和 MongoDB。

1. 复制环境变量：

```bash
cp .env.local.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.local.example .env.local
```

2. 修改 `.env.local`：

```env
APP_PASSWORD=你的登录密码
SESSION_SECRET=足够长的随机字符串
CRON_SECRET=足够长的随机字符串
```

Compose 内部 MongoDB 地址保持：

```env
MONGODB_URI=mongodb://mongo:27017
```

3. 启动：

```bash
docker compose up -d --build
```

4. 打开：

```text
http://127.0.0.1:3000
```

查看日志：

```bash
docker compose logs -f app
```

停止：

```bash
docker compose down
```

如果要同时删除 MongoDB 数据卷：

```bash
docker compose down -v
```

本地 Docker 部署会启用内置队列 runner，默认每 30 秒处理一次 `jobs` 队列。可以通过 `LOCAL_JOB_RUNNER_INTERVAL_MS` 调整，设置为 `0` 可关闭。

也可以不用 Docker，使用本机 Node + MongoDB：

```bash
npm install
npm run build
npm start
```

这种方式需要你自己启动 MongoDB，并把 `.env` 里的 `MONGODB_URI` 改成可访问地址。

### 方式二：无 Docker，本机 Node 部署

适合 Windows、Linux 服务器、NAS 或内网机器。你需要自己准备：

- Node.js 20 或更高版本
- MongoDB
- 一个能长期运行 Node 进程的方式，例如 PM2、systemd、Windows 任务计划程序或 NSSM

1. 安装依赖并构建：

```bash
npm ci
npm run build
```

2. 准备 `.env`：

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=re_save
APP_PASSWORD=你的登录密码
SESSION_SECRET=足够长的随机字符串
PORT=3000
LOCAL_JOB_RUNNER_INTERVAL_MS=30000
```

3. 直接启动：

```bash
npm start
```

打开：

```text
http://127.0.0.1:3000
```

#### 使用 PM2

```bash
npm install -g pm2
npm ci
npm run build
pm2 start deploy/pm2.config.cjs
pm2 save
pm2 startup
```

查看日志：

```bash
pm2 logs re-save
```

重启：

```bash
pm2 restart re-save
```

#### 使用 systemd

Linux 服务器可以参考：

```text
deploy/re-save.service.example
```

复制到：

```bash
sudo cp deploy/re-save.service.example /etc/systemd/system/re-save.service
sudo systemctl daemon-reload
sudo systemctl enable --now re-save
```

如果你的项目不在 `/opt/re-save`，需要先修改 service 文件里的 `WorkingDirectory` 和 `ExecStart`。

#### 使用 Nginx 反向代理

如果你有域名，可以让 Nginx 转发到本地 3000：

```nginx
server {
  listen 80;
  server_name re-save.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

生产环境建议再配置 HTTPS。

## Cloudflare 部署

### 推荐方式：Cloudflare Tunnel + 本地 Node 服务

这个项目当前后端使用 Express、MongoDB Node Driver、SMTP、网页解析和文件上传，最稳妥的 Cloudflare 方式是：

```text
用户 -> Cloudflare -> Cloudflare Tunnel -> 你的本地/服务器 Node 服务 -> MongoDB
```

优点：

- 不需要公网 IP
- 不需要把后端改成 Workers
- 可以继续使用当前 Express 服务和 MongoDB
- Cloudflare 负责 HTTPS 和域名入口

步骤：

1. 先用“无 Docker，本机 Node 部署”或 Docker Compose 在机器上启动应用：

```text
http://127.0.0.1:3000
```

2. 安装并登录 `cloudflared`。

3. 创建 Tunnel：

```bash
cloudflared tunnel create re-save
```

4. 配置 DNS：

```bash
cloudflared tunnel route dns re-save re-save.example.com
```

5. 复制并修改示例配置：

```text
deploy/cloudflared-config.yml.example
```

把里面的：

```yaml
hostname: re-save.example.com
service: http://127.0.0.1:3000
```

改成你的域名。

6. 启动 Tunnel：

```bash
cloudflared tunnel --config deploy/cloudflared-config.yml.example run
```

生产环境建议把 cloudflared 安装成系统服务。

### Cloudflare Pages 只部署前端

也可以把前端放到 Cloudflare Pages，但 API 仍需要部署在其他地方，例如本机 Node 服务、VPS、Vercel Function 或 Docker 服务。

这种方案需要给前端配置 API Base URL。当前项目默认使用同域 `/api`，如果前后端分离部署，需要额外改前端请求地址。

### 不推荐：直接部署到 Cloudflare Workers

当前项目不能原样直接部署到 Cloudflare Workers，主要原因：

- Workers 不是完整 Node.js 长驻运行环境。
- 当前后端依赖 Express 的 Node 运行方式。
- MongoDB 官方 Node Driver、`multer`、部分网页解析和 SMTP 逻辑不适合直接搬到 Workers。
- Workers 更适合 Fetch API、D1/KV/R2/Queues/Workflows 等 Cloudflare 原生绑定。

如果要完全 Cloudflare 原生部署，需要较大改造：

- Express 改为 Hono 或原生 Worker fetch handler
- MongoDB 改为 D1 或外部 HTTP Data API
- 图片改为 R2
- 异步任务改为 Cloudflare Queues 或 Workflows
- 邮件改为 HTTP 邮件服务 API

当前阶段建议使用 Cloudflare Tunnel。

## 使用顺序

1. 启动 MongoDB，并确认 `.env` 的 `MONGODB_URI` 可连接。
2. 登录后先创建分类。
3. 在“AI 配置”里添加至少一个模型配置，并设置为默认。
4. 在“记录”里手动写内容，或在“网页”里输入 URL 生成 Markdown 记录。
5. 在“通知”里维护邮箱、分组、Bark 地址和 token。
6. 在“日报”里预览并发送当天记录。

## 数据集合

- `categories`：分类
- `records`：记录，包含 `priority`、`url`、`content`、`markdown`、`tags`、`imageUrls`
- `ai_configs`：AI 配置，API Key 会加密后写入数据库
- `contacts`：通知用户，包含邮箱、分组、Bark 地址和 token
- `delivery_logs`：邮件和通知发送日志
- `shares`：记录分享链接，分享密码只保存哈希
- `jobs`：异步任务队列，用于网页总结、AI 整理和日报发送

## 注意

AI 配置目前按 OpenAI 兼容接口实现：`{baseUrl}/chat/completions`。例如 OpenAI 官方地址填写 `https://api.openai.com/v1`，模型名填写实际模型。

Bark 默认地址是 `https://api.day.app`，也可以在联系人里为单个用户配置自建 Bark 地址。

## Vercel 部署

项目已包含 `vercel.json` 和 `api/index.js`。Vercel 会把 `/api/*` 转发到 Express Function，把 `/share/*` 回退到前端页面。

Vercel 上必须使用公网 MongoDB，例如 MongoDB Atlas。不要使用 `127.0.0.1` 或 `192.168.*` 地址。

慢任务通过 `jobs` 集合异步执行。用户操作会先入队，前端轮询任务状态；`vercel.json` 中的 Cron 每分钟请求 `/api/jobs/run`，每次默认处理 2 个任务。

建议在 Vercel 环境变量里设置：

```env
CRON_SECRET=一个足够长的随机字符串
IMAGE_MAX_BYTES=4194304
WEB_FETCH_TIMEOUT_MS=10000
JOB_RUN_LIMIT=2
JOB_MAX_ATTEMPTS=3
JOB_LOCK_MS=240000
```

免费账户建议保持 `maxDuration` 为 60 秒，避免单次任务过长。任务失败会自动重试，超过重试次数会标记为 failed。
