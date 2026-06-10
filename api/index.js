import { app, ensureReady } from '../server/index.js';

function startupErrorMessage(error) {
  const message = String(error?.message || '');
  if (message.includes('MONGODB_URI') || message.includes('APP_PASSWORD')) {
    return message;
  }
  if (/mongo|mongodb|server selection|authentication|auth|enotfound|econnrefused|etimedout/i.test(message)) {
    return '服务启动失败：MongoDB 无法连接或认证失败，请检查 MONGODB_URI、数据库网络白名单和账号密码。';
  }
  return '服务启动失败，请检查部署环境变量和 Vercel Function 日志。';
}

export default async function handler(req, res) {
  try {
    await ensureReady();
    return app(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ message: startupErrorMessage(error) }));
    return undefined;
  }
}
