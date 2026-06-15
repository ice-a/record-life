import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, KeyRound, Loader2, Shield, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { MarkdownContent } from '@/components/MarkdownContent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

function LoadingSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 md:px-8">
      <div className="grid gap-4 animate-pulse">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-10 w-2/3 rounded-lg bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="flex gap-3">
          <div className="h-6 w-20 rounded-full bg-muted" />
          <div className="h-6 w-16 rounded-full bg-muted" />
        </div>
      </div>
      <div className="space-y-4 rounded-xl border p-8">
        <div className="h-5 w-1/3 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export function PublicSharePage({ token }) {
  const [meta, setMeta] = useState(null);
  const [record, setRecord] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href).catch(() => null);
    setCopied(true);
    toast('链接已复制');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="share-page min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              R
            </div>
            <span className="text-sm font-medium text-muted-foreground">RE Save</span>
          </div>
          <div className="flex items-center gap-2">
            {record?.url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={record.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />原网页</a>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制链接'}
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="grid gap-8">
            {meta?.hasPassword && !record ? (
              <Card className="mx-auto w-full max-w-sm">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Shield className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{meta.title || '受保护的分享'}</CardTitle>
                  <CardDescription>输入分享密码后查看内容</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={unlock}>
                    <Field label="分享密码">
                      <Input
                        autoFocus
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="请输入分享密码"
                      />
                    </Field>
                    {error ? (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : null}
                    <Button type="submit" disabled={submitting || !password} className="h-11">
                      {submitting ? <Loader2 className="spin" /> : <KeyRound />}
                      查看内容
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            {record ? (
              <>
                <div className="grid gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">分享记录</p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">{record.title || '未命名记录'}</h1>
                  {record.summary ? (
                    <p className="text-base leading-relaxed text-muted-foreground">{record.summary}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      {record.sourceType === 'web' ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      {record.sourceType === 'web' ? '网页记录' : '手动记录'}
                    </span>
                    {record.updatedAt ? (
                      <span>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(record.updatedAt))}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">优先级 {record.priority || 3}</Badge>
                    {(record.tags || []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                  </div>
                </div>

                <Separator />

                <article className="share-article">
                  <MarkdownContent source={record.markdown || record.content} />
                </article>
              </>
            ) : null}

            {!loading && !error && !record && !meta?.hasPassword ? (
              <div className="rounded-xl border border-dashed p-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">此分享链接无效或已过期</p>
                <p className="mt-2 text-sm text-muted-foreground">请联系分享者获取新链接</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
