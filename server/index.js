import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readability } from '@mozilla/readability';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import dotenv from 'dotenv';
import express from 'express';
import { JSDOM } from 'jsdom';
import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.IMAGE_MAX_BYTES || 10 * 1024 * 1024) },
});

const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 're_save';
const appPassword = process.env.APP_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET || appPassword || 'dev-only-secret';
const cookieName = 're_save_auth';
const defaultBarkBaseUrl = process.env.BARK_DEFAULT_BASE_URL || 'https://api.day.app';

let mongoClient;
let database;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('hex');
}

function createToken() {
  const payload = JSON.stringify({
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    nonce: crypto.randomBytes(16).toString('hex'),
  });
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || signature !== sign(encoded)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (verifyToken(req.cookies[cookieName])) {
    next();
    return;
  }

  res.status(401).json({ message: '需要先登录。' });
}

function records() {
  return database.collection('records');
}

function categories() {
  return database.collection('categories');
}

function aiConfigs() {
  return database.collection('ai_configs');
}

function contacts() {
  return database.collection('contacts');
}

function deliveryLogs() {
  return database.collection('delivery_logs');
}

function shares() {
  return database.collection('shares');
}

function jobs() {
  return database.collection('jobs');
}

function encryptionKey() {
  return crypto.createHash('sha256').update(sessionSecret).digest();
}

function encryptSecret(value) {
  if (!value) {
    return '';
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(value) {
  if (!value) {
    return '';
  }
  const [ivText, tagText, encryptedText] = value.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function parseTags(input) {
  if (Array.isArray(input)) {
    return input.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(input || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hashSharePassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (!password) {
    return { salt: '', hash: '' };
  }
  return {
    salt,
    hash: crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex'),
  };
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function toId(value) {
  if (!ObjectId.isValid(value)) {
    const error = new Error('ID 无效。');
    error.status = 400;
    throw error;
  }
  return new ObjectId(value);
}

function publicDoc(doc) {
  if (!doc) {
    return null;
  }
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

function publicRecord(doc) {
  const item = publicDoc(doc);
  return {
    id: item.id,
    title: item.title || '',
    categoryId: item.categoryId || '',
    priority: item.priority || 3,
    sourceType: item.sourceType || 'manual',
    url: item.url || '',
    summary: item.summary || '',
    content: item.content || '',
    markdown: item.markdown || '',
    tags: item.tags || [],
    imageUrls: item.imageUrls || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function publicShare(doc) {
  const item = publicDoc(doc);
  return {
    id: item.id,
    token: item.token,
    recordId: item.recordId,
    title: item.title || item.recordTitle || '',
    hasPassword: Boolean(item.passwordHash),
    createdAt: item.createdAt,
  };
}

function publicJob(doc) {
  const item = publicDoc(doc);
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    payload: item.payload || {},
    result: item.result || null,
    error: item.error || '',
    attempts: item.attempts || 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    finishedAt: item.finishedAt || null,
  };
}

function publicAiConfig(doc) {
  const item = publicDoc(doc);
  return {
    id: item.id,
    name: item.name || '',
    provider: item.provider || '',
    baseUrl: item.baseUrl || '',
    model: item.model || '',
    temperature: item.temperature ?? '',
    maxTokens: item.maxTokens ?? '',
    isDefault: Boolean(item.isDefault),
    hasApiKey: Boolean(item.apiKeyEnc),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function publicContact(doc) {
  const item = publicDoc(doc);
  return {
    id: item.id,
    name: item.name || '',
    email: item.email || '',
    group: item.group || '',
    barkBaseUrl: item.barkBaseUrl || defaultBarkBaseUrl,
    barkToken: item.barkToken || '',
    active: item.active !== false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function cleanRecord(input) {
  const now = new Date();
  const priority = Number(input.priority || 3);

  return {
    title: String(input.title || '').trim(),
    categoryId: String(input.categoryId || '').trim(),
    priority: Math.min(5, Math.max(1, Number.isFinite(priority) ? priority : 3)),
    sourceType: input.sourceType === 'web' ? 'web' : 'manual',
    url: String(input.url || '').trim(),
    summary: String(input.summary || '').trim(),
    content: String(input.content || '').trim(),
    markdown: String(input.markdown || '').trim(),
    tags: parseTags(input.tags),
    imageUrls: Array.isArray(input.imageUrls)
      ? input.imageUrls.map((url) => String(url).trim()).filter(Boolean)
      : [],
    updatedAt: now,
  };
}

function cleanAiConfig(input, existing = {}) {
  const temperature = input.temperature === '' ? '' : Number(input.temperature);
  const maxTokens = input.maxTokens === '' ? '' : Number(input.maxTokens);

  const cleaned = {
    name: String(input.name || '').trim(),
    provider: String(input.provider || '').trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    model: String(input.model || '').trim(),
    temperature: Number.isFinite(temperature) ? temperature : '',
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : '',
    isDefault: Boolean(input.isDefault),
    updatedAt: new Date(),
  };

  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    cleaned.apiKeyEnc = encryptSecret(input.apiKey.trim());
  } else if (existing.apiKeyEnc) {
    cleaned.apiKeyEnc = existing.apiKeyEnc;
  }

  return cleaned;
}

function cleanContact(input) {
  return {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    group: String(input.group || '').trim(),
    barkBaseUrl: normalizeBaseUrl(input.barkBaseUrl || defaultBarkBaseUrl),
    barkToken: String(input.barkToken || '').trim(),
    active: input.active !== false,
    updatedAt: new Date(),
  };
}

function requireRecord(record) {
  if (!record.title) {
    const error = new Error('标题不能为空。');
    error.status = 400;
    throw error;
  }
  if (!record.categoryId) {
    const error = new Error('请选择分类。');
    error.status = 400;
    throw error;
  }
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  const withoutFence = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw new Error('AI 返回内容不是有效 JSON。');
  }
}

async function getAiConfig(configId) {
  let config;
  if (configId) {
    config = await aiConfigs().findOne({ _id: toId(configId) });
  } else {
    config = await aiConfigs()
      .find({})
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(1)
      .next();
  }

  if (!config) {
    const error = new Error('请先添加 AI 配置。');
    error.status = 400;
    throw error;
  }
  if (!config.baseUrl || !config.model || !config.apiKeyEnc) {
    const error = new Error('AI 配置缺少 Base URL、模型名或 API Key。');
    error.status = 400;
    throw error;
  }

  return { ...config, apiKey: decryptSecret(config.apiKeyEnc) };
}

async function callAi(configId, messages, options = {}) {
  const config = await getAiConfig(configId);
  const body = {
    model: config.model,
    messages,
    temperature: Number(config.temperature || options.temperature || 0.2),
  };

  if (Number(config.maxTokens || options.maxTokens)) {
    body.max_tokens = Number(config.maxTokens || options.maxTokens);
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'AI 请求失败。');
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 没有返回内容。');
  }

  return content;
}

async function organizeTextWithAi({ configId, title, url, text }) {
  const content = await callAi(configId, [
    {
      role: 'system',
      content:
        '你是记录整理助手。请只返回 JSON，不要输出 Markdown 代码块。JSON 字段包括 title、summary、markdown、tags。tags 必须是中文或英文短标签数组，最多 8 个。',
    },
    {
      role: 'user',
      content: `请把下面内容整理成适合保存的 Markdown 记录。\n\n标题：${title || '未命名'}\nURL：${url || '无'}\n\n内容：\n${String(text || '').slice(0, 24000)}`,
    },
  ]);
  const parsed = parseJsonLoose(content);
  return {
    title: String(parsed.title || title || '未命名记录').trim(),
    summary: String(parsed.summary || '').trim(),
    markdown: String(parsed.markdown || '').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  };
}

async function buildDigestWithAi({ configId, date, items }) {
  const digestInput = items.map((item) => ({
    title: item.title,
    priority: item.priority,
    categoryId: item.categoryId,
    url: item.url,
    summary: item.summary,
    tags: item.tags || [],
    content: (item.markdown || item.content || '').slice(0, 2000),
  }));

  const content = await callAi(configId, [
    {
      role: 'system',
      content:
        '你是日报整理助手。请只返回 JSON，不要输出 Markdown 代码块。JSON 字段包括 subject、markdown。markdown 用中文，按照优先级从高到低分组，突出待办、结论、链接和关键标签。',
    },
    {
      role: 'user',
      content: `请把 ${date} 当天记录整理成邮件日报。\n\n记录 JSON：\n${JSON.stringify(digestInput, null, 2)}`,
    },
  ]);
  const parsed = parseJsonLoose(content);
  return {
    subject: String(parsed.subject || `${date} 记录日报`).trim(),
    markdown: String(parsed.markdown || '').trim(),
  };
}

function fallbackTags(title, text) {
  return Array.from(
    new Set(
      `${title} ${text}`
        .split(/[\s,，。；;:：、/\\|()[\]{}"'`]+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2 && word.length <= 18)
        .slice(0, 8),
    ),
  );
}

function fallbackMarkdown({ title, url, text }) {
  return [
    `# ${title || '网页记录'}`,
    '',
    url ? `> 来源：${url}` : '',
    '',
    '## 摘要',
    '',
    String(text || '').slice(0, 600),
    '',
    '## 正文摘录',
    '',
    String(text || '').slice(0, 6000),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function extractWebpage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.WEB_FETCH_TIMEOUT_MS || 15000));

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RE-Save/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`网页请求失败：HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const title =
      article?.title ||
      dom.window.document.querySelector('title')?.textContent?.trim() ||
      url;
    const text =
      article?.textContent?.trim() ||
      dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim() ||
      '';

    if (!text) {
      throw new Error('没有提取到网页正文。');
    }

    return {
      title,
      text,
      excerpt: article?.excerpt || '',
      length: text.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function uploadToImageBed(file) {
  if (!process.env.IMAGE_UPLOAD_ENDPOINT) {
    throw new Error('缺少 IMAGE_UPLOAD_ENDPOINT，无法上传图片。');
  }

  const endpointUrl = new URL(process.env.IMAGE_UPLOAD_ENDPOINT);
  const authCode = process.env.IMAGE_UPLOAD_AUTH_CODE;
  const publicBaseUrl = process.env.IMAGE_UPLOAD_PUBLIC_BASE_URL || endpointUrl.origin;

  if (authCode && !endpointUrl.searchParams.has('authCode')) {
    endpointUrl.searchParams.set('authCode', authCode);
  }
  if (!endpointUrl.searchParams.has('returnFormat')) {
    endpointUrl.searchParams.set('returnFormat', 'full');
  }

  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'image');

  const response = await fetch(endpointUrl, {
    method: 'POST',
    body: form,
  });
  const responseText = await response.text();
  let data = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || responseText || '图片上传失败。');
  }

  const src =
    (typeof data === 'string' ? data : '') ||
    data?.url ||
    data?.data?.url ||
    data?.data?.links?.url ||
    data?.src ||
    (Array.isArray(data) ? data[0]?.url || data[0]?.src : '') ||
    responseText;

  const normalizedSrc = String(src || '').trim();
  if (!normalizedSrc) {
    throw new Error('图片上传成功但没有返回 URL。');
  }

  if (/^https?:\/\//i.test(normalizedSrc)) {
    return normalizedSrc;
  }
  if (normalizedSrc.startsWith('//')) {
    return `https:${normalizedSrc}`;
  }

  return new URL(normalizedSrc, publicBaseUrl).toString();
}

function getSmtpTransporter() {
  if (!process.env.SMTP_HOST) {
    const error = new Error('缺少 SMTP_HOST，无法发送邮件。');
    error.status = 400;
    throw error;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

function markdownToEmailHtml(markdown) {
  const escaped = String(markdown || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; line-height: 1.6;">${escaped}</pre>`;
}

function dayRange(dateText) {
  const date = dateText || new Date().toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { date, start, end };
}

function fallbackDigest(date, items) {
  const groups = new Map();
  for (const item of items) {
    const priority = item.priority || 3;
    if (!groups.has(priority)) {
      groups.set(priority, []);
    }
    groups.get(priority).push(item);
  }

  const lines = [`# ${date} 记录日报`, '', `共 ${items.length} 条记录。`];
  for (const priority of [...groups.keys()].sort((a, b) => b - a)) {
    lines.push('', `## 优先级 ${priority}`);
    for (const item of groups.get(priority)) {
      lines.push('', `### ${item.title}`);
      if (item.summary) lines.push('', item.summary);
      if (item.url) lines.push('', `来源：${item.url}`);
      if (item.tags?.length) lines.push('', `标签：${item.tags.join(', ')}`);
      const body = item.markdown || item.content;
      if (body) lines.push('', body.slice(0, 1200));
    }
  }

  return {
    subject: `${date} 记录日报`,
    markdown: lines.join('\n'),
  };
}

async function generateDigest({ date: dateText, categoryId, aiConfigId }) {
  const { date, start, end } = dayRange(dateText);
  const query = { createdAt: { $gte: start, $lt: end } };
  if (categoryId) {
    query.categoryId = String(categoryId);
  }

  const items = await records().find(query).sort({ priority: -1, createdAt: 1 }).toArray();
  if (items.length === 0) {
    return {
      date,
      items: [],
      subject: `${date} 记录日报`,
      markdown: `# ${date} 记录日报\n\n当天没有记录。`,
    };
  }

  try {
    const digest = await buildDigestWithAi({ configId: aiConfigId, date, items });
    return { date, items: items.map(publicRecord), ...digest };
  } catch (error) {
    if (aiConfigId) {
      throw error;
    }
    return { date, items: items.map(publicRecord), ...fallbackDigest(date, items) };
  }
}

async function getContactsForTarget({ group, contactIds, includeInactive = false }) {
  const query = {};
  if (contactIds?.length) {
    query._id = { $in: contactIds.map(toId) };
  } else if (group) {
    query.group = String(group).trim();
  }
  if (!includeInactive) {
    query.active = { $ne: false };
  }
  return contacts().find(query).sort({ group: 1, name: 1 }).toArray();
}

function uniqueEmails(contactsList, manualEmails) {
  return Array.from(
    new Set([
      ...contactsList.map((contact) => contact.email).filter(Boolean),
      ...parseTags(manualEmails),
    ]),
  );
}

async function sendBark(contact, payload) {
  if (!contact.barkToken) {
    return { skipped: true, reason: '缺少 Bark token' };
  }

  const baseUrl = normalizeBaseUrl(contact.barkBaseUrl || defaultBarkBaseUrl);
  const body = {
    title: payload.title,
    body: payload.body,
    device_key: contact.barkToken,
    group: payload.group || contact.group || 'RE Save',
    url: payload.url || '',
  };

  let response = await fetch(`${baseUrl}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const form = new URLSearchParams();
    form.set('title', body.title);
    form.set('body', body.body);
    if (body.group) form.set('group', body.group);
    if (body.url) form.set('url', body.url);
    response = await fetch(`${baseUrl}/${encodeURIComponent(contact.barkToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: form,
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Bark 通知失败：${response.status}`);
  }

  return { ok: true, response: data };
}

async function sendDigest({ date, group, emails, contactIds, categoryId, aiConfigId, notifyBark }) {
  const digest = await generateDigest({ date, categoryId, aiConfigId });
  const targetContacts = await getContactsForTarget({ group, contactIds });
  const recipients = uniqueEmails(targetContacts, emails);
  const sent = {
    email: { recipients, sent: false },
    bark: [],
  };

  if (recipients.length) {
    const transporter = getSmtpTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipients.join(','),
      subject: digest.subject,
      text: digest.markdown,
      html: markdownToEmailHtml(digest.markdown),
    });
    sent.email.sent = true;
  }

  if (notifyBark) {
    const barkTargets = targetContacts.filter((contact) => contact.barkToken);
    for (const contact of barkTargets) {
      const result = await sendBark(contact, {
        title: digest.subject,
        body: digest.markdown.slice(0, 900),
        group: group || contact.group || 'RE Save',
      });
      sent.bark.push({ contactId: contact._id.toString(), ...result });
    }
  }

  await deliveryLogs().insertOne({
    type: 'digest',
    date: digest.date,
    group: group || '',
    categoryId: categoryId || '',
    recipients,
    notifyBark: Boolean(notifyBark),
    createdAt: new Date(),
  });

  return { digest, sent };
}

async function organizeRecordById({ recordId, aiConfigId }) {
  const existing = await records().findOne({ _id: toId(recordId) });
  if (!existing) {
    const error = new Error('记录不存在。');
    error.status = 404;
    throw error;
  }

  const organized = await organizeTextWithAi({
    configId: aiConfigId,
    title: existing.title,
    url: existing.url,
    text: existing.markdown || existing.content || existing.summary,
  });

  const result = await records().findOneAndUpdate(
    { _id: existing._id },
    {
      $set: {
        title: organized.title || existing.title,
        summary: organized.summary,
        markdown: organized.markdown,
        tags: organized.tags,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  );

  return { record: publicRecord(result) };
}

async function createWebpageRecord({ url, categoryId, priority, aiConfigId }) {
  const cleanUrl = String(url || '').trim();
  const cleanCategoryId = String(categoryId || '').trim();
  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    const error = new Error('请输入 http 或 https 开头的 URL。');
    error.status = 400;
    throw error;
  }
  if (!cleanCategoryId) {
    const error = new Error('请选择分类。');
    error.status = 400;
    throw error;
  }

  const extracted = await extractWebpage(cleanUrl);
  let organized;
  try {
    organized = await organizeTextWithAi({
      configId: aiConfigId,
      title: extracted.title,
      url: cleanUrl,
      text: extracted.text,
    });
  } catch (error) {
    if (aiConfigId) {
      throw error;
    }
    organized = {
      title: extracted.title,
      summary: extracted.excerpt || extracted.text.slice(0, 260),
      markdown: fallbackMarkdown({ title: extracted.title, url: cleanUrl, text: extracted.text }),
      tags: fallbackTags(extracted.title, extracted.text),
    };
  }

  const record = {
    title: organized.title || extracted.title,
    categoryId: cleanCategoryId,
    priority: Math.min(5, Math.max(1, Number(priority || 3))),
    sourceType: 'web',
    url: cleanUrl,
    summary: organized.summary,
    content: extracted.text,
    markdown: organized.markdown,
    tags: organized.tags,
    imageUrls: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await records().insertOne(record);
  return { record: publicRecord({ _id: result.insertedId, ...record }) };
}

async function enqueueJob(type, payload = {}) {
  const now = new Date();
  const result = await jobs().insertOne({
    type,
    status: 'queued',
    payload,
    result: null,
    error: '',
    attempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  });
  return jobs().findOne({ _id: result.insertedId });
}

async function processJob(job) {
  if (job.type === 'record_organize') {
    return organizeRecordById(job.payload || {});
  }
  if (job.type === 'webpage_record') {
    return createWebpageRecord(job.payload || {});
  }
  if (job.type === 'digest_send') {
    return sendDigest(job.payload || {});
  }

  throw new Error(`未知任务类型：${job.type}`);
}

async function runQueuedJobs({ limit = Number(process.env.JOB_RUN_LIMIT || 2) } = {}) {
  const results = [];
  const now = new Date();
  const lockUntil = new Date(now.getTime() + Number(process.env.JOB_LOCK_MS || 4 * 60 * 1000));

  for (let index = 0; index < limit; index += 1) {
    const job = await jobs().findOneAndUpdate(
      {
        $or: [
          {
            status: 'queued',
            $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
          },
          {
            status: 'running',
            lockedUntil: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: 'running',
          lockedUntil: lockUntil,
          updatedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );

    if (!job) {
      break;
    }

    try {
      const result = await processJob(job);
      const updated = await jobs().findOneAndUpdate(
        { _id: job._id },
        {
          $set: {
            status: 'success',
            result,
            error: '',
            lockedUntil: null,
            updatedAt: new Date(),
            finishedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      );
      results.push(publicJob(updated));
    } catch (error) {
      const shouldRetry = (job.attempts || 0) < Number(process.env.JOB_MAX_ATTEMPTS || 3);
      const updated = await jobs().findOneAndUpdate(
        { _id: job._id },
        {
          $set: {
            status: shouldRetry ? 'queued' : 'failed',
            error: error.message || '任务执行失败。',
            lockedUntil: null,
            updatedAt: new Date(),
            finishedAt: shouldRetry ? null : new Date(),
          },
        },
        { returnDocument: 'after' },
      );
      results.push(publicJob(updated));
    }
  }

  return results;
}

async function ensureDatabase() {
  if (!mongoUri) {
    throw new Error('缺少 MONGODB_URI，请先创建 .env。');
  }
  if (!appPassword) {
    throw new Error('缺少 APP_PASSWORD，请先创建 .env。');
  }

  mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  database = mongoClient.db(dbName);
  await records()
    .dropIndex('title_text_summary_text_remarks_text_tags_text')
    .catch((error) => {
      if (error.codeName !== 'IndexNotFound') {
        throw error;
      }
    });
  await Promise.all([
    records().createIndex({
      title: 'text',
      summary: 'text',
      content: 'text',
      markdown: 'text',
      tags: 'text',
      url: 'text',
    }),
    records().createIndex({ categoryId: 1, priority: -1, createdAt: -1 }),
    records().createIndex({ createdAt: -1 }),
    categories().createIndex({ name: 1 }, { unique: true }),
    aiConfigs().createIndex({ name: 1 }, { unique: true }),
    aiConfigs().createIndex({ isDefault: -1, updatedAt: -1 }),
    contacts().createIndex({ group: 1, active: 1 }),
    contacts().createIndex({ email: 1 }),
    shares().createIndex({ token: 1 }, { unique: true }),
    shares().createIndex({ recordId: 1, createdAt: -1 }),
    jobs().createIndex({ status: 1, createdAt: 1 }),
    jobs().createIndex({ updatedAt: -1 }),
  ]);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: verifyToken(req.cookies[cookieName]) });
});

app.post('/api/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (password !== appPassword) {
    res.status(401).json({ message: '密码不正确。' });
    return;
  }

  res.cookie(cookieName, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  res.json({ authenticated: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(cookieName);
  res.json({ authenticated: false });
});

app.get('/api/categories', requireAuth, async (req, res, next) => {
  try {
    const items = await categories().find({}).sort({ name: 1 }).toArray();
    res.json(items.map(publicDoc));
  } catch (error) {
    next(error);
  }
});

app.post('/api/categories', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ message: '分类名称不能为空。' });
      return;
    }

    const result = await categories().findOneAndUpdate(
      { name },
      { $setOnInsert: { name, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' },
    );
    res.status(201).json(publicDoc(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/records', requireAuth, async (req, res, next) => {
  try {
    const query = {};
    const categoryId = String(req.query.categoryId || '').trim();
    const keyword = String(req.query.q || '').trim();

    if (categoryId) {
      query.categoryId = categoryId;
    }
    if (keyword) {
      query.$text = { $search: keyword };
    }

    const items = await records().find(query).sort({ priority: -1, updatedAt: -1 }).toArray();
    res.json(items.map(publicRecord));
  } catch (error) {
    next(error);
  }
});

app.post('/api/records', requireAuth, async (req, res, next) => {
  try {
    const record = cleanRecord(req.body || {});
    requireRecord(record);
    record.createdAt = new Date();
    const result = await records().insertOne(record);
    res.status(201).json(publicRecord({ _id: result.insertedId, ...record }));
  } catch (error) {
    next(error);
  }
});

app.put('/api/records/:id', requireAuth, async (req, res, next) => {
  try {
    const record = cleanRecord(req.body || {});
    requireRecord(record);
    const result = await records().findOneAndUpdate(
      { _id: toId(req.params.id) },
      { $set: record },
      { returnDocument: 'after' },
    );

    if (!result) {
      res.status(404).json({ message: '记录不存在。' });
      return;
    }

    res.json(publicRecord(result));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/records/:id', requireAuth, async (req, res, next) => {
  try {
    await records().deleteOne({ _id: toId(req.params.id) });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/records/:id/organize', requireAuth, async (req, res, next) => {
  try {
    const existing = await records().findOne({ _id: toId(req.params.id) });
    if (!existing) {
      res.status(404).json({ message: '记录不存在。' });
      return;
    }

    const job = await enqueueJob('record_organize', {
      recordId: existing._id.toString(),
      aiConfigId: req.body?.aiConfigId || '',
    });
    res.status(202).json({ job: publicJob(job) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await jobs().findOne({ _id: toId(req.params.id) });
    if (!job) {
      res.status(404).json({ message: '任务不存在。' });
      return;
    }
    res.json(publicJob(job));
  } catch (error) {
    next(error);
  }
});

async function handleRunJobs(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
    const expectedToken = process.env.CRON_SECRET || process.env.JOB_RUNNER_TOKEN || sessionSecret;
    const isAuthedBySession = verifyToken(req.cookies?.[cookieName]);
    if (!isAuthedBySession && token !== expectedToken) {
      res.status(401).json({ message: '无权执行任务。' });
      return;
    }
    const results = await runQueuedJobs({ limit: Number(req.body?.limit || process.env.JOB_RUN_LIMIT || 2) });
    res.json({ processed: results.length, results });
  } catch (error) {
    next(error);
  }
}

app.post('/api/jobs/run', handleRunJobs);
app.get('/api/jobs/run', handleRunJobs);

app.get('/api/shares', requireAuth, async (req, res, next) => {
  try {
    const items = await shares().find({}).sort({ createdAt: -1 }).toArray();
    const recordIds = items
      .map((item) => item.recordId)
      .filter((recordId) => ObjectId.isValid(recordId))
      .map((recordId) => new ObjectId(recordId));
    const relatedRecords = recordIds.length
      ? await records()
          .find({ _id: { $in: recordIds } }, { projection: { title: 1, url: 1 } })
          .toArray()
      : [];
    const recordMap = new Map(
      relatedRecords.map((record) => [
        record._id.toString(),
        { title: record.title || '', url: record.url || '' },
      ]),
    );

    res.json(
      items.map((item) => ({
        ...publicShare({ ...item, recordTitle: recordMap.get(item.recordId)?.title }),
        recordUrl: recordMap.get(item.recordId)?.url || '',
        missingRecord: !recordMap.has(item.recordId),
      })),
    );
  } catch (error) {
    next(error);
  }
});

app.get('/api/records/:id/shares', requireAuth, async (req, res, next) => {
  try {
    const recordId = String(req.params.id);
    if (!ObjectId.isValid(recordId)) {
      res.status(400).json({ message: '记录 ID 无效。' });
      return;
    }
    const items = await shares().find({ recordId }).sort({ createdAt: -1 }).toArray();
    res.json(items.map(publicShare));
  } catch (error) {
    next(error);
  }
});

app.post('/api/records/:id/shares', requireAuth, async (req, res, next) => {
  try {
    const recordId = String(req.params.id);
    const record = await records().findOne({ _id: toId(recordId) });
    if (!record) {
      res.status(404).json({ message: '记录不存在。' });
      return;
    }

    const password = String(req.body?.password || '').trim();
    const passwordInfo = hashSharePassword(password);
    const share = {
      token: crypto.randomBytes(24).toString('base64url'),
      recordId,
      title: record.title,
      passwordSalt: passwordInfo.salt,
      passwordHash: passwordInfo.hash,
      createdAt: new Date(),
    };
    await shares().insertOne(share);
    res.status(201).json(publicShare(share));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/shares/:token', requireAuth, async (req, res, next) => {
  try {
    await shares().deleteOne({ token: String(req.params.token) });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/public/shares/:token', async (req, res, next) => {
  try {
    const share = await shares().findOne({ token: String(req.params.token) });
    if (!share) {
      res.status(404).json({ message: '分享不存在或已失效。' });
      return;
    }

    if (share.passwordHash) {
      const password = String(req.body?.password || '');
      const passwordInfo = hashSharePassword(password, share.passwordSalt);
      if (passwordInfo.hash !== share.passwordHash) {
        res.status(401).json({ message: '分享密码不正确。', passwordRequired: true });
        return;
      }
    }

    const record = await records().findOne({ _id: toId(share.recordId) });
    if (!record) {
      res.status(404).json({ message: '分享记录不存在。' });
      return;
    }

    res.json({
      share: publicShare(share),
      record: publicRecord(record),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/shares/:token/meta', async (req, res, next) => {
  try {
    const share = await shares().findOne({ token: String(req.params.token) });
    if (!share) {
      res.status(404).json({ message: '分享不存在或已失效。' });
      return;
    }
    res.json(publicShare(share));
  } catch (error) {
    next(error);
  }
});

app.get('/api/cron/daily-email', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
    const expectedToken = process.env.CRON_SECRET || process.env.JOB_RUNNER_TOKEN || sessionSecret;
    if (token !== expectedToken) {
      res.status(401).json({ message: '无权创建日报任务。' });
      return;
    }

    if (String(process.env.DAILY_EMAIL_ENABLED || '').toLowerCase() !== 'true') {
      res.json({ queued: false, message: 'DAILY_EMAIL_ENABLED 未启用。' });
      return;
    }

    const job = await enqueueJob('digest_send', {
      date: new Date().toISOString().slice(0, 10),
      group: process.env.DAILY_EMAIL_GROUP || '',
      emails: process.env.DAILY_EMAIL_EXTRA_RECIPIENTS || '',
      categoryId: process.env.DAILY_EMAIL_CATEGORY_ID || '',
      aiConfigId: process.env.DAILY_EMAIL_AI_CONFIG_ID || '',
      notifyBark: String(process.env.DAILY_BARK_ENABLED || 'true').toLowerCase() !== 'false',
    });
    const results = await runQueuedJobs({ limit: Number(process.env.JOB_RUN_LIMIT || 2) });
    res.status(202).json({ queued: true, job: publicJob(job), processed: results.length, results });
  } catch (error) {
    next(error);
  }
});

app.post('/api/records/webpage', requireAuth, async (req, res, next) => {
  try {
    const url = String(req.body?.url || '').trim();
    const categoryId = String(req.body?.categoryId || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ message: '请输入 http 或 https 开头的 URL。' });
      return;
    }
    if (!categoryId) {
      res.status(400).json({ message: '请选择分类。' });
      return;
    }

    const job = await enqueueJob('webpage_record', {
      url,
      categoryId,
      priority: Math.min(5, Math.max(1, Number(req.body?.priority || 3))),
      aiConfigId: req.body?.aiConfigId || '',
    });
    res.status(202).json({ job: publicJob(job) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/images', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请选择图片。' });
      return;
    }
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ message: '只能上传图片文件。' });
      return;
    }

    const url = await uploadToImageBed(req.file);
    res.status(201).json({ url });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai-configs', requireAuth, async (req, res, next) => {
  try {
    const items = await aiConfigs().find({}).sort({ isDefault: -1, updatedAt: -1 }).toArray();
    res.json(items.map(publicAiConfig));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai-configs', requireAuth, async (req, res, next) => {
  try {
    const config = cleanAiConfig(req.body || {});
    if (!config.name || !config.baseUrl || !config.model || !config.apiKeyEnc) {
      res.status(400).json({ message: '请填写名称、Base URL、模型名和 API Key。' });
      return;
    }
    config.createdAt = new Date();
    if (config.isDefault) {
      await aiConfigs().updateMany({}, { $set: { isDefault: false } });
    }
    const result = await aiConfigs().insertOne(config);
    res.status(201).json(publicAiConfig({ _id: result.insertedId, ...config }));
  } catch (error) {
    next(error);
  }
});

app.put('/api/ai-configs/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await aiConfigs().findOne({ _id: toId(req.params.id) });
    if (!existing) {
      res.status(404).json({ message: 'AI 配置不存在。' });
      return;
    }
    const config = cleanAiConfig(req.body || {}, existing);
    if (!config.name || !config.baseUrl || !config.model || !config.apiKeyEnc) {
      res.status(400).json({ message: '请填写名称、Base URL、模型名和 API Key。' });
      return;
    }
    if (config.isDefault) {
      await aiConfigs().updateMany({ _id: { $ne: existing._id } }, { $set: { isDefault: false } });
    }
    const result = await aiConfigs().findOneAndUpdate(
      { _id: existing._id },
      { $set: config },
      { returnDocument: 'after' },
    );
    res.json(publicAiConfig(result));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/ai-configs/:id', requireAuth, async (req, res, next) => {
  try {
    await aiConfigs().deleteOne({ _id: toId(req.params.id) });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/contacts', requireAuth, async (req, res, next) => {
  try {
    const query = {};
    const group = String(req.query.group || '').trim();
    if (group) {
      query.group = group;
    }
    const items = await contacts().find(query).sort({ group: 1, name: 1 }).toArray();
    res.json(items.map(publicContact));
  } catch (error) {
    next(error);
  }
});

app.post('/api/contacts', requireAuth, async (req, res, next) => {
  try {
    const contact = cleanContact(req.body || {});
    if (!contact.email && !contact.barkToken) {
      res.status(400).json({ message: '联系人至少需要邮箱或 Bark token。' });
      return;
    }
    contact.createdAt = new Date();
    const result = await contacts().insertOne(contact);
    res.status(201).json(publicContact({ _id: result.insertedId, ...contact }));
  } catch (error) {
    next(error);
  }
});

app.put('/api/contacts/:id', requireAuth, async (req, res, next) => {
  try {
    const contact = cleanContact(req.body || {});
    if (!contact.email && !contact.barkToken) {
      res.status(400).json({ message: '联系人至少需要邮箱或 Bark token。' });
      return;
    }
    const result = await contacts().findOneAndUpdate(
      { _id: toId(req.params.id) },
      { $set: contact },
      { returnDocument: 'after' },
    );
    if (!result) {
      res.status(404).json({ message: '联系人不存在。' });
      return;
    }
    res.json(publicContact(result));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res, next) => {
  try {
    await contacts().deleteOne({ _id: toId(req.params.id) });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/notifications/bark', requireAuth, async (req, res, next) => {
  try {
    const targetContacts = await getContactsForTarget({
      group: req.body?.group,
      contactIds: req.body?.contactIds || [],
    });
    const barkTargets = targetContacts.filter((contact) => contact.barkToken);
    const results = [];
    for (const contact of barkTargets) {
      const result = await sendBark(contact, {
        title: String(req.body?.title || 'RE Save 通知'),
        body: String(req.body?.body || ''),
        url: String(req.body?.url || ''),
        group: String(req.body?.group || contact.group || 'RE Save'),
      });
      results.push({ contactId: contact._id.toString(), ...result });
    }
    res.json({ sent: results.length, results });
  } catch (error) {
    next(error);
  }
});

app.post('/api/digest/preview', requireAuth, async (req, res, next) => {
  try {
    const digest = await generateDigest({
      date: req.body?.date,
      categoryId: req.body?.categoryId,
      aiConfigId: req.body?.aiConfigId,
    });
    res.json(digest);
  } catch (error) {
    next(error);
  }
});

app.post('/api/digest/send', requireAuth, async (req, res, next) => {
  try {
    const job = await enqueueJob('digest_send', {
      date: req.body?.date,
      group: req.body?.group,
      emails: req.body?.emails,
      contactIds: req.body?.contactIds || [],
      categoryId: req.body?.categoryId,
      aiConfigId: req.body?.aiConfigId,
      notifyBark: req.body?.notifyBark !== false,
    });
    res.status(202).json({ job: publicJob(job) });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(rootDir, 'dist')));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(rootDir, 'dist', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || '服务异常。' });
});

function scheduleDailyDigest() {
  if (process.env.VERCEL === '1') {
    return;
  }

  if (String(process.env.DAILY_EMAIL_ENABLED || '').toLowerCase() !== 'true') {
    return;
  }

  cron.schedule(
    process.env.DAILY_EMAIL_CRON || '0 20 * * *',
    async () => {
      try {
        await enqueueJob('digest_send', {
          date: new Date().toISOString().slice(0, 10),
          group: process.env.DAILY_EMAIL_GROUP || '',
          emails: process.env.DAILY_EMAIL_EXTRA_RECIPIENTS || '',
          categoryId: process.env.DAILY_EMAIL_CATEGORY_ID || '',
          aiConfigId: process.env.DAILY_EMAIL_AI_CONFIG_ID || '',
          notifyBark: String(process.env.DAILY_BARK_ENABLED || 'true').toLowerCase() !== 'false',
        });
      } catch (error) {
        console.error(`Daily digest failed: ${error.message}`);
      }
    },
    { timezone: process.env.APP_TIMEZONE || 'Asia/Shanghai' },
  );
}

function scheduleLocalJobRunner() {
  if (process.env.VERCEL === '1') {
    return;
  }
  const intervalMs = Number(process.env.LOCAL_JOB_RUNNER_INTERVAL_MS || 30000);
  if (!intervalMs) {
    return;
  }
  setInterval(async () => {
    try {
      await runQueuedJobs({ limit: Number(process.env.JOB_RUN_LIMIT || 2) });
    } catch (error) {
      console.error(`Job runner failed: ${error.message}`);
    }
  }, intervalMs).unref?.();
}

let readyPromise;

export async function ensureReady() {
  if (!readyPromise) {
    readyPromise = ensureDatabase().then(() => {
      scheduleDailyDigest();
      scheduleLocalJobRunner();
    });
  }
  return readyPromise;
}

export { app };

if (process.env.VERCEL !== '1') {
  ensureReady()
    .then(() => {
      app.listen(port, () => {
        console.log(`API server listening on http://127.0.0.1:${port}`);
      });
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
