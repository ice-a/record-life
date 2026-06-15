import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Share2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Field } from '@/components/Field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export function ShareDialog({ open, record, onClose, onChanged, setError }) {
  const [password, setPassword] = useState('');
  const [sharesList, setSharesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [copiedToken, setCopiedToken] = useState('');

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
      toast('分享链接已生成');
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
      toast('分享链接已删除');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyShare(token) {
    await navigator.clipboard?.writeText(shareUrl(token)).catch(() => null);
    setCopiedToken(token);
    toast('链接已复制');
    setTimeout(() => setCopiedToken(''), 2000);
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
              <AlertDescription className="flex items-center gap-2">
                <span className="truncate text-sm">{createdUrl}</span>
              </AlertDescription>
            </Alert>
          ) : null}
          <Separator />
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">已有分享</h3>
            {sharesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无分享链接。</p>
            ) : (
              sharesList.map((share) => (
                <div key={share.token} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/30">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{shareUrl(share.token)}</p>
                    <p className="text-xs text-muted-foreground">{share.hasPassword ? '需要密码' : '无需密码'}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyShare(share.token)}>
                      {copiedToken === share.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteShare(share.token)}>
                      <Trash2 className="h-4 w-4" />
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
