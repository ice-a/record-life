import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { Field } from '@/components/Field';
import { MarkdownContent } from '@/components/MarkdownContent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 animate-pulse">
      <div className="h-8 w-2/3 rounded bg-muted" />
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-1 rounded bg-muted"><div className="h-1 w-1/3 rounded bg-primary" /></div>
      <div className="space-y-3 rounded-lg border p-6">
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
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-8 md:px-8 md:py-12">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="share-topbar">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-primary">RE Save 分享</p>
                <h1 className="mt-1 truncate text-2xl font-semibold leading-tight">{record?.title || meta?.title || '分享记录'}</h1>
                {record?.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{record.summary}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {record?.sourceType ? (
                    <span className="flex items-center gap-1">
                      {record.sourceType === 'web' ? '🌐 网页记录' : '📝 手动记录'}
                    </span>
                  ) : null}
                  {record?.updatedAt ? (
                    <span>更新于 {new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(record.updatedAt))}</span>
                  ) : null}
                </div>
              </div>
              {record?.url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={record.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />打开原网页</a>
                </Button>
              ) : null}
            </div>

            {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

            {meta?.hasPassword && !record ? (
              <Card className="mx-auto w-full max-w-md">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{meta.title || '受保护的分享'}</CardTitle>
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
                    <Button type="submit" disabled={submitting || !password}>
                      {submitting ? <Loader2 className="spin" /> : <KeyRound />}
                      查看内容
                    </Button>
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

            {!loading && !error && !record && !meta?.hasPassword ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">此分享链接无效或已过期。</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
