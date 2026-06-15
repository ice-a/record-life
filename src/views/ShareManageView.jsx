import { useState } from 'react';
import { Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
