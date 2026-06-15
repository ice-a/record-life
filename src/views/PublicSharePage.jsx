import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Field } from '@/components/Field';
import { MarkdownContent } from '@/components/MarkdownContent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
