import { useEffect, useState } from 'react';
import { Globe, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function WebCaptureView({ categories, aiConfigs, onJobCreated, setError }) {
  const [form, setForm] = useState({ url: '', categoryId: categories[0]?.id || '', priority: 3, aiConfigId: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!form.categoryId && categories[0]) setForm((current) => ({ ...current, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
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
