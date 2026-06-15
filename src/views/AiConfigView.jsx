import { useState } from 'react';
import { Bot, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { emptyAiConfig, normalizeAiConfig } from '@/lib/utils';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export function AiConfigView({ aiConfigs, onReload, setError }) {
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
      toast('AI 配置已保存');
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
      toast('AI 配置已删除');
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
            {aiConfigs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                暂无 AI 配置
              </div>
            ) : (
              aiConfigs.map((config) => (
                <button
                  type="button"
                  key={config.id}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all duration-150 hover:bg-accent ${form.id === config.id ? 'bg-accent shadow-sm' : ''}`}
                  onClick={() => setForm(normalizeAiConfig(config))}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{config.name}</div>
                    <div className="text-xs text-muted-foreground">{config.model}{config.isDefault ? ' · 默认' : ''}</div>
                  </div>
                </button>
              ))
            )}
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
