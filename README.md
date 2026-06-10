# RE Save

一个带密码入口的记录管理工具。前端使用 React + Vite + shadcn/ui，服务端负责 MongoDB、AI、网页提取、图片图床、SMTP 邮件和 Bark 通知。

## 功能

- 输入访问密码后进入工作台
- 按分类管理记录，可设置优先级、URL、标签、原始内容和 Markdown
- 独立维护多个 AI 配置，支持 OpenAI 兼容的 `/chat/completions` 接口
- 使用 AI 整理已有记录内容
- 输入网页 URL 后提取正文，用 AI 总结成 Markdown，并生成标签写入数据库
- 图片上传到 CloudFlare ImgBed，返回 URL 并写入记录
- 管理通知用户：邮箱、分组、Bark 地址、Bark token
- 按当天记录生成日报，可发送给数据库联系人、手动追加邮箱、指定分组，也可同时推送 Bark
- 可配置每日定时邮件任务
- 单条记录可生成公开分享链接，分享时可设置访问密码
- 可在“分享”页查看和删除所有已分享内容
- 网页总结、AI 整理和日报发送使用异步任务队列执行，适合 Vercel Functions

## 环境变量

复制 `.env.example` 为 `.env`，然后按需修改。生产环境至少要设置 `MONGODB_URI`、`APP_PASSWORD`、`SESSION_SECRET`、`CRON_SECRET` 和图片上传相关变量。

```env
# MongoDB 连接地址；本地开发一般使用 127.0.0.1，Vercel 必须使用公网 MongoDB。
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
# 每日邮件任务的 cron 表达式，按 APP_TIMEZONE 执行；Vercel 部署时由 vercel.json 触发接口。
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

## 本地开发

本地开发需要 Node.js 20 或更高版本，以及可连接的 MongoDB。

```bash
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell 复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

浏览器打开：

```text
http://127.0.0.1:5173
```

开发脚本会同时启动：

- Vite 前端：`http://127.0.0.1:5173`
- Express API：默认 `http://127.0.0.1:3001`

如果 5173 端口被占用，`predev` 会先执行 `scripts/stop-dev.ps1` 尝试停止旧的本项目开发进程。

## 本地部署

适合 Windows、Linux 服务器、NAS 或内网机器。你需要自己准备：

- Node.js 20 或更高版本
- MongoDB
- 一个能长期运行 Node 进程的方式，例如 Windows 任务计划程序、NSSM、系统服务或进程守护工具

步骤：

1. 安装依赖并构建前端。

```bash
npm ci
npm run build
```

2. 准备 `.env`，至少设置：

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=re_save
APP_PASSWORD=你的登录密码
SESSION_SECRET=足够长的随机字符串
CRON_SECRET=足够长的随机字符串
PORT=3000
IMAGE_UPLOAD_ENDPOINT=https://你的图床域名/upload
IMAGE_UPLOAD_AUTH_CODE=你的图床访问密码
IMAGE_UPLOAD_PUBLIC_BASE_URL=https://你的图床域名
LOCAL_JOB_RUNNER_INTERVAL_MS=30000
```

3. 启动服务。

```bash
npm start
```

打开：

```text
http://127.0.0.1:3000
```

本地部署会启用内置队列 runner，默认每 30 秒处理一次 `jobs` 队列。可以通过 `LOCAL_JOB_RUNNER_INTERVAL_MS` 调整，设置为 `0` 可关闭。

## Vercel 部署

项目已包含 `vercel.json` 和 `api/index.js`。Vercel 会执行 `npm run build`，把 `dist` 作为静态前端，并把 `/api/*` 转发到 Express Function。

Vercel 必须使用公网 MongoDB，例如 MongoDB Atlas。不要使用 `127.0.0.1`、`localhost` 或 `192.168.*` 地址。

在 Vercel 项目里配置环境变量，至少包括：

```env
MONGODB_URI=你的公网 MongoDB 连接地址
MONGODB_DB=re_save
APP_PASSWORD=你的登录密码
SESSION_SECRET=足够长的随机字符串
CRON_SECRET=足够长的随机字符串
IMAGE_UPLOAD_ENDPOINT=https://你的图床域名/upload
IMAGE_UPLOAD_AUTH_CODE=你的图床访问密码
IMAGE_UPLOAD_PUBLIC_BASE_URL=https://你的图床域名
IMAGE_MAX_BYTES=4194304
WEB_FETCH_TIMEOUT_MS=10000
JOB_RUN_LIMIT=2
JOB_MAX_ATTEMPTS=3
JOB_LOCK_MS=240000
```

如果要使用邮件日报，还需要配置 SMTP 和日报变量：

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
DAILY_EMAIL_ENABLED=true
DAILY_EMAIL_GROUP=
DAILY_EMAIL_EXTRA_RECIPIENTS=
DAILY_EMAIL_CATEGORY_ID=
DAILY_EMAIL_AI_CONFIG_ID=
DAILY_BARK_ENABLED=true
```

Vercel 部署时不要依赖本地内置定时器。慢任务通过 `jobs` 集合异步执行：

- 用户操作会先创建任务，前端随后调用 `/api/jobs/run` 处理队列，并轮询任务状态。
- `vercel.json` 只保留 `/api/cron/daily-email` 每天触发一次，适配 Vercel 免费账户的 Cron 限制。
- 日报 Cron 会先创建日报任务，再立即执行一次队列；是否发送由 `DAILY_EMAIL_ENABLED` 控制。

免费账户建议保持 `maxDuration` 为 60 秒，避免单次任务过长。任务失败会自动重试，超过 `JOB_MAX_ATTEMPTS` 会标记为 failed。

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
