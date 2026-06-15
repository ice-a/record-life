import { useEffect, useState } from 'react';
import { CheckCircle, Globe, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const steps = [
  { key: 'submit', label: '提交任务' },
  { key: 'extract', label: '提取网页正文' },
  { key: 'organize', label: 'AI 整理总结' },
  { key: 'save', label: '保存记录' },
];

export function WebCaptureView({ categories, aiConfigs, onJobCreated, setError }) {
  const [form, setForm] = useState({ url: '', categoryId: categories[0]?.id || '', priority: 3, aiConfigId: '' });
  const [loading, setLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    if (!form.categoryId && categories[0]) setForm((current) => ({ ...current, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setLastError('');
    setJobStatus({ step: 'submit', job: null });
    try {
      const result = await api('/api/records/webpage', { method: 'POST', body: JSON.stringify(form) });
      setJobStatus({ step: 'extract', job: result.job });
      await onJobCreated?.(result.job);
      setJobStatus({ step: 'done', job: result.job });
      setForm((current) => ({ ...current, url: '' }));
      toast('网页记录已保存');
    } catch (error) {
      setLastError(error.message);
      setJobStatus({ step: 'failed', job: null });
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    setJobStatus(null);
    setLastError('');
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
              {loading ? '处理中...' : '提取总结并保存'}
            </Button>
          </form>

          {jobStatus && jobStatus.step !== 'done' && (
            <div className="mt-4 rounded-lg border p-4">
              <div className="grid gap-2">
                {steps.map((step, idx) => {
                  const stepIdx = steps.findIndex((s) => s.key === jobStatus.step);
                  const isDone = idx < stepIdx;
                  const isCurrent = idx === stepIdx;
                  const isFailed = jobStatus.step === 'failed' && idx === stepIdx;
                  return (
                    <div key={step.key} className="flex items-center gap-3 text-sm">
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : isFailed ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" />
                      )}
                      <span className={isDone ? 'text-muted-foreground' : isCurrent ? 'font-medium' : isFailed ? 'text-red-500' : 'text-muted-foreground'}>
                        {step.label}
                        {isFailed && lastError ? ` — ${lastError}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              {jobStatus.step === 'failed' && (
                <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  重试
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
