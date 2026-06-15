import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  ImagePlus,
  Keyboard,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounce, useKeyboardShortcuts, useTheme } from '@/lib/hooks';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import './styles.css';

const emptyRecord = {
  id: '',
  title: '',
  categoryId: '',
  priority: 3,
  sourceType: 'manual',
  url: '',
  summary: '',
  content: '',
  markdown: '',
  tags: '',
  imageUrls: [],
};

const emptyAiConfig = {
  id: '',
  name: '',
  provider: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  temperature: '0.2',
  maxTokens: '',
  isDefault: false,
};

function toTagText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : tags || '';
}

function normalizeRecord(record) {
  return {
    ...emptyRecord,
    ...record,
    markdown: record.markdown || record.content || '',
    content: record.content || '',
    tags: toTagText(record.tags),
    imageUrls: record.imageUrls || [],
  };
}

function normalizeAiConfig(config) {
  return {
    ...emptyAiConfig,
    ...config,
    apiKey: '',
    temperature: config.temperature ?? '',
    maxTokens: config.maxTokens ?? '',
  };
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function Field({ label, children }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-primary">{eyebrow}</p>
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const markdownComponents = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  img: ({ alt, ...props }) => <img {...props} alt={alt || ''} loading="lazy" />,
  table: (props) => (
    <div className="markdown-table-wrap">
      <table {...props} />
    </div>
  ),
};

function MarkdownContent({ source, fallback = '没有可展示内容。', className = '' }) {
  const markdown = String(source || '').trim();

  if (!markdown) {
    return (
      <div className={`markdown-body markdown-body-empty ${className}`}>
        <p>{fallback}</p>
      </div>
    );
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>RE Save</CardTitle>
          <CardDescription>输入访问密码进入记录工作台</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="访问密码">
              <Input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={loading || !password}>
              {loading ? <Loader2 className="spin" /> : <KeyRound />}
              进入
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function CategoryPanel({ categories, activeCategoryId, recordCounts, onSelect, onCreate, onRename, onDelete, creating }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const total = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);

  async function submit(event) {
    event.preventDefault();
    const created = await onCreate(name);
    if (created) setName('');
  }

  function startRename(category) {
    setEditingId(category.id);
    setEditName(category.name);
  }

  async function saveRename() {
    if (!editName.trim()) return;
    await onRename(editingId, editName.trim());
    setEditingId('');
    setEditName('');
  }

  return (
    <Card className="min-h-0">
      <CardHeader>
        <SectionHeader eyebrow="分类" title="内容分组" />
      </CardHeader>
      <CardContent className="flex h-[calc(100%-5rem)] flex-col gap-3">
        <div className="grid gap-1">
          <button
            type="button"
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${activeCategoryId === '' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
            onClick={() => onSelect('')}
          >
            <span>全部记录</span>
            <Badge variant="secondary">{total}</Badge>
          </button>
          <div className="grid gap-1 overflow-auto">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`group flex items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${activeCategoryId === category.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
              >
                {editingId === category.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename();
                        if (event.key === 'Escape') setEditingId('');
                      }}
                      className="h-7 py-1 text-sm"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveRename}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-between gap-1"
                      onClick={() => onSelect(category.id)}
                    >
                      <span className="truncate">{category.name}</span>
                      <Badge variant="secondary">{recordCounts[category.id] || 0}</Badge>
                    </button>
                    <div className="ml-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startRename(category)} title="重命名">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(category.id, category.name);
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <form className="mt-auto flex gap-2" onSubmit={submit}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="新建分类" />
          <Button size="icon" type="submit" disabled={creating || !name.trim()} title="添加分类">
            <Plus />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecordList({ records, activeId, onSelect, onCreate, categoryName }) {
  const [localQuery, setLocalQuery] = useState('');
  const debouncedQuery = useDebounce(localQuery, 250);

  const displayRecords = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => {
      const haystack = [record.title, record.summary, record.content, record.markdown, record.url, record.sourceType, ...(record.tags || [])].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [debouncedQuery, records]);

  return (
    <Card className="min-h-0">
      <CardHeader>
        <SectionHeader
          eyebrow="记录"
          title={categoryName}
          action={
            <Button onClick={onCreate}>
              <Plus />
              新建
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="搜索标题、内容、URL 或标签 (Ctrl+F)"
          />
          {localQuery ? (
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
              {displayRecords.length}/{records.length}
            </span>
          ) : null}
        </div>
        <div className="scroll-list mt-4 grid gap-3">
          {displayRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {localQuery ? '没有匹配的记录' : '暂无记录'}
            </div>
          ) : (
            displayRecords.map((record) => (
              <button
                type="button"
                key={record.id}
                className={`rounded-lg border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm ${activeId === record.id ? 'border-primary shadow-sm' : ''}`}
                onClick={() => onSelect(record)}
              >
                <div className="flex items-center gap-2">
                  {record.sourceType === 'web' ? <Globe className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                  <strong className="truncate text-sm">{record.title}</strong>
                </div>
                <p className="two-line mt-2 text-sm text-muted-foreground">
                  {record.summary || record.markdown || record.content || '无摘要'}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>优先级 {record.priority || 3}</span>
                  <span>{formatDate(record.updatedAt)}</span>
                </div>
                {record.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {record.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ShareDialog({ open, record, onClose, onChanged, setMessage, setError }) {
  const [password, setPassword] = useState('');
  const [sharesList, setSharesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');

  useEffect(() => {
    if (!open || !record?.id) return;
    setPassword('');
    setCreatedUrl('');
    setLoading(true);
    api(`/api/records/${record.id}/shares`)
      .then(setSharesList)
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
  }, [open, record?.id, setError]);

  function shareUrl(token) {
    return `${window.location.origin}/share/${token}`;
  }

  async function createShare() {
    if (!record?.id) return;
    setLoading(true);
    setError('');
    try {
      const share = await api(`/api/records/${record.id}/shares`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      const url = shareUrl(share.token);
      setSharesList((current) => [share, ...current]);
      setCreatedUrl(url);
      setPassword('');
      await navigator.clipboard?.writeText(url).catch(() => null);
      await onChanged?.();
      setMessage('分享链接已生成');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteShare(token) {
    setLoading(true);
    setError('');
    try {
      await api(`/api/shares/${token}`, { method: 'DELETE' });
      setSharesList((current) => current.filter((share) => share.token !== token));
      await onChanged?.();
      setMessage('分享链接已删除');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享记录</DialogTitle>
          <DialogDescription>{record?.title || '当前记录'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="分享密码">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="留空则无需密码" />
          </Field>
          {createdUrl ? (
            <Alert variant="success">
              <AlertDescription>分享链接：{createdUrl}</AlertDescription>
            </Alert>
          ) : null}
          <Separator />
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">已有分享</h3>
            {sharesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无分享链接。</p>
            ) : (
              sharesList.map((share) => (
                <div key={share.token} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{shareUrl(share.token)}</p>
                    <p className="text-xs text-muted-foreground">{share.hasPassword ? '需要密码' : '无需密码'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigator.clipboard?.writeText(shareUrl(share.token))}>
                      <Copy />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteShare(share.token)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button disabled={loading || !record?.id} onClick={createShare}>
            {loading ? <Loader2 className="spin" /> : <Share2 />}
            生成分享链接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordEditor({
  form,
  categories,
  aiConfigs,
  saving,
  actionLoading,
  onChange,
  onSave,
  onDelete,
  onReset,
  onOrganize,
  onUploadImage,
  onShare,
  onExportMarkdown,
  onExportJson,
}) {
  const [aiConfigId, setAiConfigId] = useState('');
  const contentMarkdown = form.markdown;

  function updateField(field, value) {
    onChange({ ...form, [field]: value });
  }

  function removeImage(url) {
    onChange({ ...form, imageUrls: form.imageUrls.filter((item) => item !== url) });
  }

  return (
    <Card className="editor-panel min-h-0">
      <CardHeader>
        <SectionHeader
          eyebrow={form.id ? '编辑' : '新建'}
          title={form.id ? form.title || '未命名记录' : '新记录'}
          action={
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onReset} title="重置 (Ctrl+N)">
                <Edit3 />
              </Button>
              {form.id ? (
                <Button variant="ghost" size="icon" onClick={onShare} title="分享">
                  <Share2 />
                </Button>
              ) : null}
              {form.id ? (
                <div className="relative group">
                  <Button variant="ghost" size="icon" title="导出">
                    <Download />
                  </Button>
                  <div className="absolute right-0 top-full z-50 mt-1 hidden w-40 rounded-md border bg-popover p-1 shadow-md group-hover:block">
                    <button type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={onExportMarkdown}>
                      <FileText className="h-4 w-4" />
                      导出 Markdown
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={onExportJson}>
                      <Download className="h-4 w-4" />
                      导出 JSON
                    </button>
                  </div>
                </div>
              ) : null}
              {form.id ? (
                <Button variant="ghost" size="icon" onClick={onDelete} title="删除">
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          }
        />
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSave}>
          <div className="form-grid two">
            <Field label="标题">
              <Input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="记录标题" />
            </Field>
            <Field label="分类">
              <Select value={form.categoryId || 'none'} onValueChange={(value) => updateField('categoryId', value === 'none' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择分类</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="form-grid three">
            <Field label="优先级">
              <Select value={String(form.priority)} onValueChange={(value) => updateField('priority', Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 最高</SelectItem>
                  <SelectItem value="4">4 较高</SelectItem>
                  <SelectItem value="3">3 普通</SelectItem>
                  <SelectItem value="2">2 较低</SelectItem>
                  <SelectItem value="1">1 最低</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="来源">
              <Select value={form.sourceType} onValueChange={(value) => updateField('sourceType', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手动记录</SelectItem>
                  <SelectItem value="web">网页记录</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="标签">
              <Input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="逗号分隔" />
            </Field>
          </div>
          <Field label="URL">
            <Input value={form.url} onChange={(event) => updateField('url', event.target.value)} placeholder="网页来源地址，可选" />
          </Field>
          <Field label="摘要">
            <Input value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="一句话摘要" />
          </Field>
          <div className="markdown-workspace">
            <Field label="内容">
              <Textarea
                className="mono markdown-editor-input"
                value={contentMarkdown}
                onChange={(event) => updateField('markdown', event.target.value)}
                rows={16}
                placeholder="# 标题&#10;&#10;- 要点&#10;- 链接、图片和表格都按 Markdown 写"
              />
            </Field>
            <div className="markdown-live-panel">
              <Label>预览</Label>
              <MarkdownContent source={contentMarkdown} fallback="开始编写后会显示预览。" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" asChild>
              <label>
                <ImagePlus />
                上传图片
                <input hidden type="file" accept="image/*" onChange={(event) => onUploadImage(event.target.files?.[0])} />
              </label>
            </Button>
            <span className="text-sm text-muted-foreground">图片上传公共图床后写入当前记录</span>
          </div>
          {form.imageUrls.length ? (
            <div className="grid gap-2">
              {form.imageUrls.map((url) => (
                <div key={url} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-2">
                  <span className="truncate text-sm">{url}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeImage(url)}>
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 px-6 py-3 backdrop-blur">
            <div className="w-56">
              <Select value={aiConfigId || 'default'} onValueChange={(value) => setAiConfigId(value === 'default' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="AI 配置" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认 AI 配置</SelectItem>
                  {aiConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" disabled={!form.id || actionLoading} onClick={() => onOrganize(aiConfigId)}>
              {actionLoading ? <Loader2 className="spin" /> : <Sparkles />}
              AI 整理
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="spin" /> : <Save />}
              保存记录
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function WebCaptureView({ categories, aiConfigs, onJobCreated, setMessage, setError }) {
  const [form, setForm] = useState({ url: '', categoryId: categories[0]?.id || '', priority: 3, aiConfigId: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!form.categoryId && categories[0]) setForm((current) => ({ ...current, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/api/records/webpage', { method: 'POST', body: JSON.stringify(form) });
      await onJobCreated?.(result.job);
      setForm((current) => ({ ...current, url: '' }));
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <SectionHeader eyebrow="网页" title="记录网页内容" description="提取正文，使用 AI 总结成 Markdown 并生成标签" action={<Globe className="h-5 w-5 text-primary" />} />
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="网页 URL">
              <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com/article" />
            </Field>
            <div className="form-grid three">
              <Field label="分类">
                <Select value={form.categoryId || 'none'} onValueChange={(value) => setForm({ ...form, categoryId: value === 'none' ? '' : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择分类</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="优先级">
                <Select value={String(form.priority)} onValueChange={(value) => setForm({ ...form, priority: Number(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 最高</SelectItem>
                    <SelectItem value="4">4 较高</SelectItem>
                    <SelectItem value="3">3 普通</SelectItem>
                    <SelectItem value="2">2 较低</SelectItem>
                    <SelectItem value="1">1 最低</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="AI 配置">
                <Select value={form.aiConfigId || 'default'} onValueChange={(value) => setForm({ ...form, aiConfigId: value === 'default' ? '' : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">默认配置</SelectItem>
                    {aiConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={loading} className="justify-self-start">
              {loading ? <Loader2 className="spin" /> : <Sparkles />}
              提取总结并保存
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AiConfigView({ aiConfigs, onReload, setMessage, setError }) {
  const [form, setForm] = useState(emptyAiConfig);
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm(emptyAiConfig);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(form.id ? `/api/ai-configs/${form.id}` : '/api/ai-configs', {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      await onReload();
      reset();
      setMessage('AI 配置已保存');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form.id || !window.confirm('确认删除这个 AI 配置？')) return;
    setSaving(true);
    try {
      await api(`/api/ai-configs/${form.id}`, { method: 'DELETE' });
      await onReload();
      reset();
      setMessage('AI 配置已删除');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <SectionHeader eyebrow="AI" title="模型配置" action={<Button size="icon" variant="outline" onClick={reset}><Plus /></Button>} />
        </CardHeader>
        <CardContent>
          <div className="grid gap-1">
            {aiConfigs.map((config) => (
              <button
                type="button"
                key={config.id}
                className={`rounded-md px-3 py-2 text-left text-sm transition hover:bg-accent ${form.id === config.id ? 'bg-accent' : ''}`}
                onClick={() => setForm(normalizeAiConfig(config))}
              >
                <div className="font-medium">{config.name}</div>
                <div className="text-xs text-muted-foreground">{config.model}{config.isDefault ? ' · 默认' : ''}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionHeader eyebrow={form.id ? '编辑' : '新建'} title="AI 配置" action={<Bot className="h-5 w-5 text-primary" />} />
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={save}>
            <div className="form-grid two">
              <Field label="名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="提供商"><Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></Field>
            </div>
            <Field label="Base URL"><Input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></Field>
            <div className="form-grid two">
              <Field label="模型名"><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field>
              <Field label="API Key"><Input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={form.hasApiKey ? '已保存，留空不修改' : 'sk-...'} /></Field>
            </div>
            <div className="form-grid three">
              <Field label="温度"><Input value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} /></Field>
              <Field label="最大 Token"><Input value={form.maxTokens} onChange={(event) => setForm({ ...form, maxTokens: event.target.value })} /></Field>
              <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm">
                <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: Boolean(checked) })} />
                默认配置
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {form.id ? <Button type="button" variant="destructive" onClick={remove}><Trash2 />删除</Button> : null}
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="spin" /> : <Save />}保存配置</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ShareManageView({ sharesList, onReload, setMessage, setError }) {
  const [loading, setLoading] = useState(false);

  function shareUrl(token) {
    return `${window.location.origin}/share/${token}`;
  }

  async function copyShare(token) {
    await navigator.clipboard?.writeText(shareUrl(token)).catch(() => null);
    setMessage('分享链接已复制');
  }

  async function deleteShare(token) {
    if (!window.confirm('确认删除这个分享链接？')) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/shares/${token}`, { method: 'DELETE' });
      await onReload();
      setMessage('分享链接已删除');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeader eyebrow="分享" title="分享管理" action={<Button variant="outline" onClick={onReload} disabled={loading}>{loading ? <Loader2 className="spin" /> : <RefreshCw />}刷新</Button>} />
      </CardHeader>
      <CardContent>
        {sharesList.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">暂无分享链接。</div>
        ) : (
          <div className="grid gap-3">
            {sharesList.map((share) => (
              <div key={share.token} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{share.title || '未命名记录'}</strong>
                    <Badge variant={share.hasPassword ? 'default' : 'outline'}>{share.hasPassword ? '有密码' : '无密码'}</Badge>
                    {share.missingRecord ? <Badge variant="destructive">记录已不存在</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{shareUrl(share.token)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">创建时间：{formatDate(share.createdAt)}{share.recordUrl ? ` · 来源：${share.recordUrl}` : ''}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => copyShare(share.token)}><Copy />复制</Button>
                  <Button variant="destructive" onClick={() => deleteShare(share.token)}><Trash2 />删除</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublicSharePage({ token }) {
  const [meta, setMeta] = useState(null);
  const [record, setRecord] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/api/public/shares/${token}/meta`)
      .then((share) => {
        setMeta(share);
        if (!share.hasPassword) {
          return api(`/api/public/shares/${token}`, { method: 'POST', body: JSON.stringify({ password: '' }) }).then((data) => setRecord(data.record));
        }
        return null;
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function unlock(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api(`/api/public/shares/${token}`, { method: 'POST', body: JSON.stringify({ password }) });
      setRecord(data.record);
    } catch (unlockError) {
      setError(unlockError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="share-page min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-6 md:px-8 md:py-10">
        <div className="share-topbar">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">RE Save 分享</p>
            <h1 className="mt-1 truncate text-2xl font-semibold">{record?.title || meta?.title || '分享记录'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{record?.summary || '只读记录内容'}</p>
          </div>
          {record?.url ? (
            <Button variant="outline" asChild>
              <a href={record.url} target="_blank" rel="noreferrer"><ExternalLink />打开原网页</a>
            </Button>
          ) : null}
        </div>

        {loading ? <div className="h-1 rounded bg-muted"><div className="h-1 w-1/3 animate-pulse rounded bg-primary" /></div> : null}
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

        {meta?.hasPassword && !record ? (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>{meta.title || '受保护的分享'}</CardTitle>
              <CardDescription>输入分享密码后查看内容</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={unlock}>
                <Field label="分享密码"><Input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
                <Button type="submit" disabled={submitting || !password}>{submitting ? <Loader2 className="spin" /> : <KeyRound />}查看内容</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {record ? (
          <article className="share-article">
            <div className="share-meta-row">
              <Badge variant="secondary">优先级 {record.priority || 3}</Badge>
              {(record.tags || []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
            </div>
            <MarkdownContent source={record.markdown || record.content} />
          </article>
        ) : null}
      </div>
    </main>
  );
}

const hitokotoQuotes = [
  '生活就像骑自行车，想保持平衡就得往前走。',
  '每天进步一点点，就是最好的捷径。',
  '把复杂的事情简单化，你就赢了。',
  '种一棵树最好的时间是十年前，其次是现在。',
  '世界上唯一不变的就是变化本身。',
  '不积跬步，无以至千里。',
  '你不需要很厉害才能开始，但你需要开始才能很厉害。',
  '所谓无底深渊，下去也是前程万里。',
  '万物皆有裂痕，那是光照进来的地方。',
  '做你自己，因为别人都有人做了。',
  '与其担心未来，不如现在好好努力。',
  '最好的投资就是投资自己。',
  '所有的大人都曾经是小孩，虽然只有少数人记得。',
  '当你觉得晚了的时候，恰恰是最早的时候。',
  '保持热爱，奔赴山海。',
];

function Hitokoto() {
  const [quote, setQuote] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    function next() {
      indexRef.current = (indexRef.current + 1) % hitokotoQuotes.length;
      setQuote(hitokotoQuotes[indexRef.current]);
    }
    next();
    const timer = setInterval(next, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground" title="一言">
      <Quote className="h-3 w-3 shrink-0 opacity-50" />
      <span className="truncate">{quote}</span>
    </p>
  );
}

function App() {
  const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)$/);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState('records');
  const [categories, setCategories] = useState([]);
  const [records, setRecords] = useState([]);
  const [aiConfigs, setAiConfigs] = useState([]);
  const [sharesList, setSharesList] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  function exportRecord(format = 'markdown') {
    if (!recordForm.id) return;
    let content;
    let filename;
    let mimeType;

    if (format === 'json') {
      const exportData = {
        title: recordForm.title,
        categoryId: recordForm.categoryId,
        priority: recordForm.priority,
        sourceType: recordForm.sourceType,
        url: recordForm.url,
        summary: recordForm.summary,
        tags: recordForm.tags,
        markdown: recordForm.markdown,
        imageUrls: recordForm.imageUrls,
      };
      content = JSON.stringify(exportData, null, 2);
      filename = `${recordForm.title || 'record'}.json`;
      mimeType = 'application/json';
    } else {
      const lines = [
        recordForm.markdown || recordForm.content || '',
        '',
        '---',
        recordForm.summary ? `> ${recordForm.summary}` : '',
        recordForm.url ? `> 来源: ${recordForm.url}` : '',
        recordForm.tags ? `> 标签: ${toTagText(recordForm.tags)}` : '',
        `> 优先级: ${recordForm.priority}`,
      ].filter(Boolean);
      content = lines.join('\n');
      filename = `${recordForm.title || 'record'}.md`;
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(`已导出 ${format === 'json' ? 'JSON' : 'Markdown'} 文件`);
  }

  if (shareMatch) return <PublicSharePage token={decodeURIComponent(shareMatch[1])} />;

  const activeCategoryName = useMemo(() => {
    if (!activeCategoryId) return '全部内容';
    return categories.find((category) => category.id === activeCategoryId)?.name || '当前分类';
  }, [activeCategoryId, categories]);

  const recordCounts = useMemo(() => records.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {}), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (activeCategoryId && record.categoryId !== activeCategoryId) return false;
      return true;
    });
  }, [activeCategoryId, records]);

  const autoSaveTimerRef = useRef(null);

  function autoSaveDraft() {
    if (!recordForm.id || !recordForm.title) return;
    try {
      const drafts = JSON.parse(localStorage.getItem('re_save_drafts') || '{}');
      drafts[recordForm.id] = {
        ...recordForm,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('re_save_drafts', JSON.stringify(drafts));
    } catch {}
  }

  function clearDraft(recordId) {
    try {
      const drafts = JSON.parse(localStorage.getItem('re_save_drafts') || '{}');
      delete drafts[recordId];
      localStorage.setItem('re_save_drafts', JSON.stringify(drafts));
    } catch {}
  }

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (recordForm.id && recordForm.title) {
      autoSaveTimerRef.current = setTimeout(autoSaveDraft, 5000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [recordForm.id, recordForm.markdown, recordForm.title, recordForm.summary, recordForm.tags]);

  const latestRef = useRef({ recordForm, saveRecord, deleteRecord, resetRecordForm, exportRecord, setShareDialogOpen });
  latestRef.current = { recordForm, saveRecord, deleteRecord, resetRecordForm, exportRecord, setShareDialogOpen };

  const handleKeyboardShortcuts = useMemo(() => ({
    's': () => {
      if (latestRef.current.recordForm.id) latestRef.current.saveRecord(new Event('submit'));
    },
    'n': () => latestRef.current.resetRecordForm(),
    'd': () => {
      if (latestRef.current.recordForm.id) latestRef.current.deleteRecord();
    },
    'f': () => {
      const input = document.querySelector('.scroll-list')?.closest('.min-h-0')?.querySelector('input[placeholder*="搜索"]');
      if (input) input.focus();
    },
    'shift+s': () => {
      if (latestRef.current.recordForm.id) latestRef.current.setShareDialogOpen(true);
    },
    'shift+e': () => {
      if (latestRef.current.recordForm.id) latestRef.current.exportRecord('markdown');
    },
    'shift+j': () => {
      if (latestRef.current.recordForm.id) latestRef.current.exportRecord('json');
    },
  }), []);

  useKeyboardShortcuts(handleKeyboardShortcuts);

  async function loadCoreData() {
    setLoading(true);
    setError('');
    try {
      const [nextCategories, nextRecords, nextAiConfigs, nextShares] = await Promise.all([
        api('/api/categories'),
        api('/api/records'),
        api('/api/ai-configs'),
        api('/api/shares'),
      ]);
      setCategories(nextCategories);
      setRecords(nextRecords);
      setAiConfigs(nextAiConfigs);
      setSharesList(nextShares);
      if (!recordForm.categoryId && nextCategories[0]) {
        setRecordForm((current) => ({ ...current, categoryId: nextCategories[0].id }));
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function reloadAiConfigs() { setAiConfigs(await api('/api/ai-configs')); }
  async function reloadShares() { setSharesList(await api('/api/shares')); }

  async function runJobsOnce() {
    await api('/api/jobs/run', {
      method: 'POST',
      body: JSON.stringify({ limit: 2 }),
    }).catch(() => null);
  }

  function trackJob(job, options = {}) {
    if (!job?.id) return;
    setMessage(`${options.label || '任务'}已加入队列`);
    runJobsOnce();

    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        const current = await api(`/api/jobs/${job.id}`);
        if (current.status === 'success') {
          window.clearInterval(timer);
          if (options.onSuccess) {
            await options.onSuccess(current);
          }
          setMessage(`${options.label || '任务'}已完成`);
        } else if (current.status === 'failed') {
          window.clearInterval(timer);
          setError(current.error || `${options.label || '任务'}执行失败`);
        } else if (Date.now() - startedAt > 10 * 60 * 1000) {
          window.clearInterval(timer);
          setMessage(`${options.label || '任务'}仍在后台处理中，可稍后刷新查看`);
        }
      } catch (jobError) {
        window.clearInterval(timer);
        setError(jobError.message);
      }
    }, 3000);
  }

  useEffect(() => {
    api('/api/session')
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (authenticated) loadCoreData();
  }, [authenticated]);

  async function createCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    setCreatingCategory(true);
    setError('');
    try {
      const category = await api('/api/categories', { method: 'POST', body: JSON.stringify({ name: trimmed }) });
      setCategories((current) => {
        const exists = current.some((item) => item.id === category.id);
        return exists ? current : [...current, category].sort((a, b) => a.name.localeCompare(b.name));
      });
      setActiveCategoryId(category.id);
      setRecordForm((current) => ({ ...current, categoryId: category.id }));
      setMessage('分类已创建');
      return true;
    } catch (createError) {
      setError(createError.message);
      return false;
    } finally {
      setCreatingCategory(false);
    }
  }

  async function renameCategory(categoryId, newName) {
    setError('');
    try {
      const updated = await api(`/api/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      setCategories((current) =>
        current.map((category) => (category.id === categoryId ? { ...category, name: updated.name } : category)),
      );
      setMessage('分类已重命名');
    } catch (renameError) {
      setError(renameError.message);
    }
  }

  async function deleteCategory(categoryId, categoryName) {
    if (!window.confirm(`确认删除分类"${categoryName}"？该分类下的记录将变为未分类。`)) return;
    setError('');
    try {
      await api(`/api/categories/${categoryId}`, { method: 'DELETE' });
      setCategories((current) => current.filter((category) => category.id !== categoryId));
      setRecords((current) =>
        current.map((record) => (record.categoryId === categoryId ? { ...record, categoryId: '' } : record)),
      );
      if (activeCategoryId === categoryId) {
        setActiveCategoryId('');
        resetRecordForm('');
      }
      setMessage('分类已删除');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function resetRecordForm(categoryId = activeCategoryId) {
    setRecordForm({ ...emptyRecord, categoryId: categoryId || categories[0]?.id || '' });
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await api(recordForm.id ? `/api/records/${recordForm.id}` : '/api/records', {
        method: recordForm.id ? 'PUT' : 'POST',
        body: JSON.stringify(recordForm),
      });
      setRecords((current) => {
        const exists = current.some((record) => record.id === saved.id);
        return exists ? current.map((record) => (record.id === saved.id ? saved : record)) : [saved, ...current];
      });
      setRecordForm(normalizeRecord(saved));
      clearDraft(saved.id);
      setMessage('记录已保存');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!recordForm.id || !window.confirm('确认删除这条记录？')) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/records/${recordForm.id}`, { method: 'DELETE' });
      clearDraft(recordForm.id);
      setRecords((current) => current.filter((record) => record.id !== recordForm.id));
      resetRecordForm();
      setMessage('记录已删除');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }

  async function organizeRecord(aiConfigId) {
    if (!recordForm.id) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await api(`/api/records/${recordForm.id}/organize`, {
        method: 'POST',
        body: JSON.stringify({ aiConfigId }),
      });
      await trackJob(result.job, {
        label: 'AI 整理',
        onSuccess: async (job) => {
          const organized = job.result?.record;
          if (organized) {
            setRecords((current) => current.map((record) => (record.id === organized.id ? organized : record)));
            setRecordForm(normalizeRecord(organized));
          } else {
            await loadCoreData();
          }
        },
      });
    } catch (organizeError) {
      setError(organizeError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function uploadImage(file) {
    if (!file) return;
    setActionLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      const result = await api('/api/images', { method: 'POST', body });
      setRecordForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, result.url],
        markdown: `${current.markdown || ''}\n\n![image](${result.url})`.trim(),
      }));
      setMessage('图片已上传');
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' }).catch(() => null);
    setAuthenticated(false);
    setRecords([]);
    setCategories([]);
    setAiConfigs([]);
    setSharesList([]);
    setRecordForm(emptyRecord);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="spin h-6 w-6 text-primary" />
      </main>
    );
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  const navItems = [
    { id: 'records', label: '记录', icon: FileText },
    { id: 'web', label: '网页', icon: Globe },
    { id: 'ai', label: 'AI 配置', icon: Bot },
    { id: 'shares', label: '分享', icon: Share2 },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">RE Save</h1>
            <Hitokoto />
          </div>
          <Tabs value={view} onValueChange={setView} className="min-w-0">
            <TabsList className="max-w-[720px] overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.id} value={item.id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)} title="键盘快捷键">
              <Keyboard className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={loadCoreData} title="刷新">
              <RefreshCw className={loading ? 'spin' : ''} />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="退出登录">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1560px] gap-4 px-4 py-4">
        {message ? (
          <Alert variant="success">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{message}</span>
              <button type="button" onClick={() => setMessage('')}><X className="h-4 w-4" /></button>
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button>
            </AlertDescription>
          </Alert>
        ) : null}

        {view === 'records' ? (
          <>
            <div className="records-layout">
            <CategoryPanel
              categories={categories}
              activeCategoryId={activeCategoryId}
              recordCounts={recordCounts}
              creating={creatingCategory}
              onCreate={createCategory}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onSelect={(categoryId) => {
                setActiveCategoryId(categoryId);
                resetRecordForm(categoryId);
              }}
            />
            <RecordList
              records={filteredRecords}
              activeId={recordForm.id}
              categoryName={activeCategoryName}
              onSelect={(record) => setRecordForm(normalizeRecord(record))}
              onCreate={() => resetRecordForm()}
            />
            <RecordEditor
              form={recordForm}
              categories={categories}
              aiConfigs={aiConfigs}
              saving={saving}
              actionLoading={actionLoading}
              onChange={setRecordForm}
              onSave={saveRecord}
              onDelete={deleteRecord}
              onReset={() => resetRecordForm()}
              onOrganize={organizeRecord}
              onUploadImage={uploadImage}
              onShare={() => setShareDialogOpen(true)}
              onExportMarkdown={() => exportRecord('markdown')}
              onExportJson={() => exportRecord('json')}
            />
          </div>
          </>
        ) : null}

        {view === 'web' ? (
          <WebCaptureView
            categories={categories}
            aiConfigs={aiConfigs}
            setMessage={setMessage}
            setError={setError}
            onJobCreated={(job) =>
              trackJob(job, {
                label: '网页提取',
                onSuccess: async (doneJob) => {
                  const record = doneJob.result?.record;
                  if (record) {
                    setRecords((current) => [record, ...current]);
                    setRecordForm(normalizeRecord(record));
                    setView('records');
                  } else {
                    await loadCoreData();
                  }
                },
              })
            }
          />
        ) : null}

        {view === 'ai' ? <AiConfigView aiConfigs={aiConfigs} onReload={reloadAiConfigs} setMessage={setMessage} setError={setError} /> : null}
        {view === 'shares' ? <ShareManageView sharesList={sharesList} onReload={reloadShares} setMessage={setMessage} setError={setError} /> : null}
      </div>

      <ShareDialog
        open={shareDialogOpen}
        record={recordForm}
        onClose={() => setShareDialogOpen(false)}
        onChanged={reloadShares}
        setMessage={setMessage}
        setError={setError}
      />

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              键盘快捷键
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            {[
              ['Ctrl+S', '保存记录'],
              ['Ctrl+N', '新建记录'],
              ['Ctrl+D', '删除记录'],
              ['Ctrl+F', '聚焦搜索框'],
              ['Ctrl+Shift+S', '分享记录'],
              ['Ctrl+Shift+E', '导出 Markdown'],
              ['Ctrl+Shift+J', '导出 JSON'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
