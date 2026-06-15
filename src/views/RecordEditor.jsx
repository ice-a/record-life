import { useState } from 'react';
import { Download, Edit3, FileText, ImagePlus, Loader2, Save, Share2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { MarkdownContent } from '@/components/MarkdownContent';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function RecordEditor({
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
  const [filling, setFilling] = useState(false);
  const contentMarkdown = form.markdown;

  function updateField(field, value) {
    onChange({ ...form, [field]: value });
  }

  function removeImage(url) {
    onChange({ ...form, imageUrls: form.imageUrls.filter((item) => item !== url) });
  }

  async function aiFill() {
    if (!contentMarkdown || !contentMarkdown.trim()) {
      toast('请先填写内容', 'error');
      return;
    }
    setFilling(true);
    try {
      const result = await api('/api/records/fill-with-ai', {
        method: 'POST',
        body: JSON.stringify({ markdown: contentMarkdown, title: form.title, aiConfigId }),
      });
      const patch = {};
      if (result.title) patch.title = result.title;
      if (result.summary) patch.summary = result.summary;
      if (result.tags?.length) patch.tags = result.tags.join(', ');
      if (Object.keys(patch).length) {
        onChange({ ...form, ...patch });
        toast('AI 已填充标题、摘要和标签');
      } else {
        toast('AI 未返回有效内容', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setFilling(false);
    }
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
            <Button type="button" variant="outline" disabled={filling || !contentMarkdown} onClick={aiFill}>
              {filling ? <Loader2 className="spin" /> : <Wand2 />}
              AI 填充
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
