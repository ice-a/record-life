import { useState } from 'react';
import { Copy, ExternalLink, Globe, Loader2, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/Toast';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ShareManageView({ sharesList, onReload, setError }) {
  const [loading, setLoading] = useState(false);

  function shareUrl(token) {
    return `${window.location.origin}/share/${token}`;
  }

  async function copyShare(token) {
    await navigator.clipboard?.writeText(shareUrl(token)).catch(() => null);
    toast('分享链接已复制');
  }

  async function deleteShare(token) {
    if (!window.confirm('确认删除这个分享链接？')) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/shares/${token}`, { method: 'DELETE' });
      await onReload();
      toast('分享链接已删除');
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
          <div className="rounded-lg border border-dashed p-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ExternalLink className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-muted-foreground">暂无分享链接</p>
            <p className="mt-2 text-sm text-muted-foreground">在记录编辑器中点击分享按钮创建</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sharesList.map((share) => (
              <div key={share.token} className="group rounded-xl border p-5 transition-colors hover:border-primary/30 hover:shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {share.missingRecord ? <Shield className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{share.title || '未命名记录'}</strong>
                      <Badge variant={share.hasPassword ? 'default' : 'outline'} className="text-xs">
                        {share.hasPassword ? '有密码' : '无密码'}
                      </Badge>
                      {share.missingRecord ? <Badge variant="destructive" className="text-xs">记录已不存在</Badge> : null}
                    </div>
                    <p className="mt-1.5 truncate text-sm text-muted-foreground">{shareUrl(share.token)}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>创建于 {formatDate(share.createdAt)}</span>
                      {share.recordUrl ? (
                        <span className="flex items-center gap-1 truncate">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{share.recordUrl}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="outline" size="sm" onClick={() => copyShare(share.token)}>
                      <Copy className="h-3.5 w-3.5" />复制
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteShare(share.token)}>
                      <Trash2 className="h-3.5 w-3.5" />删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
