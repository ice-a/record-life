import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownAZ, ArrowUpAZ, Bot, CalendarArrowDown, FileText, Globe, Keyboard, Loader2, LogOut, Moon, RefreshCw, Share2, Sun, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useKeyboardShortcuts, useTheme } from '@/lib/hooks';
import { emptyRecord, normalizeRecord, toTagText } from '@/lib/utils';
import { Hitokoto } from '@/components/Hitokoto';
import { toast, ToastContainer } from '@/components/Toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiConfigView } from '@/views/AiConfigView';
import { CategoryPanel } from '@/views/CategoryPanel';
import { Login } from '@/views/Login';
import { PublicSharePage } from '@/views/PublicSharePage';
import { RecordEditor } from '@/views/RecordEditor';
import { RecordList } from '@/views/RecordList';
import { ShareDialog } from '@/views/ShareDialog';
import { ShareManageView } from '@/views/ShareManageView';
import { WebCaptureView } from '@/views/WebCaptureView';
import './styles.css';

function App() {
  const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)$/);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState('records');
  const [categories, setCategories] = useState([]);
  const [records, setRecords] = useState([]);
  const [aiConfigs, setAiConfigs] = useState([]);
  const [sharesList, setSharesList] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  function exportRecord(format = 'markdown') {
    if (!recordForm.id) return;
    let content;
    let filename;
    let mimeType;

    if (format === 'json') {
      const exportData = {
        title: recordForm.title,
        categoryId: recordForm.categoryId,
        priority: recordForm.priority,
        sourceType: recordForm.sourceType,
        url: recordForm.url,
        summary: recordForm.summary,
        tags: recordForm.tags,
        markdown: recordForm.markdown,
        imageUrls: recordForm.imageUrls,
      };
      content = JSON.stringify(exportData, null, 2);
      filename = `${recordForm.title || 'record'}.json`;
      mimeType = 'application/json';
    } else {
      const lines = [
        recordForm.markdown || recordForm.content || '',
        '',
        '---',
        recordForm.summary ? `> ${recordForm.summary}` : '',
        recordForm.url ? `> 来源: ${recordForm.url}` : '',
        recordForm.tags ? `> 标签: ${toTagText(recordForm.tags)}` : '',
        `> 优先级: ${recordForm.priority}`,
      ].filter(Boolean);
      content = lines.join('\n');
      filename = `${recordForm.title || 'record'}.md`;
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`已导出 ${format === 'json' ? 'JSON' : 'Markdown'} 文件`);
  }

  if (shareMatch) return <PublicSharePage token={decodeURIComponent(shareMatch[1])} />;

  const activeCategoryName = useMemo(() => {
    if (!activeCategoryId) return '全部内容';
    return categories.find((category) => category.id === activeCategoryId)?.name || '当前分类';
  }, [activeCategoryId, categories]);

  const recordCounts = useMemo(() => records.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {}), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (activeCategoryId && record.categoryId !== activeCategoryId) return false;
      return true;
    });
  }, [activeCategoryId, records]);

  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'priority') cmp = (b.priority || 3) - (a.priority || 3);
      else if (sortBy === 'title') cmp = (a.title || '').localeCompare(b.title || '');
      else cmp = new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [filteredRecords, sortBy, sortDir]);

  const autoSaveTimerRef = useRef(null);

  function autoSaveDraft() {
    if (!recordForm.id || !recordForm.title) return;
    try {
      const drafts = JSON.parse(localStorage.getItem('re_save_drafts') || '{}');
      drafts[recordForm.id] = {
        ...recordForm,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('re_save_drafts', JSON.stringify(drafts));
    } catch {}
  }

  function clearDraft(recordId) {
    try {
      const drafts = JSON.parse(localStorage.getItem('re_save_drafts') || '{}');
      delete drafts[recordId];
      localStorage.setItem('re_save_drafts', JSON.stringify(drafts));
    } catch {}
  }

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (recordForm.id && recordForm.title) {
      autoSaveTimerRef.current = setTimeout(autoSaveDraft, 5000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [recordForm.id, recordForm.markdown, recordForm.title, recordForm.summary, recordForm.tags]);

  const latestRef = useRef({ recordForm, saveRecord, deleteRecord, resetRecordForm, exportRecord, setShareDialogOpen });
  latestRef.current = { recordForm, saveRecord, deleteRecord, resetRecordForm, exportRecord, setShareDialogOpen };

  const handleKeyboardShortcuts = useMemo(() => ({
    's': () => {
      if (latestRef.current.recordForm.id) latestRef.current.saveRecord(new Event('submit'));
    },
    'n': () => latestRef.current.resetRecordForm(),
    'd': () => {
      if (latestRef.current.recordForm.id) latestRef.current.deleteRecord();
    },
    'f': () => {
      const input = document.querySelector('.scroll-list')?.closest('.min-h-0')?.querySelector('input[placeholder*="搜索"]');
      if (input) input.focus();
    },
    'shift+s': () => {
      if (latestRef.current.recordForm.id) latestRef.current.setShareDialogOpen(true);
    },
    'shift+e': () => {
      if (latestRef.current.recordForm.id) latestRef.current.exportRecord('markdown');
    },
    'shift+j': () => {
      if (latestRef.current.recordForm.id) latestRef.current.exportRecord('json');
    },
  }), []);

  useKeyboardShortcuts(handleKeyboardShortcuts);

  async function loadCoreData() {
    setLoading(true);
    setError('');
    try {
      const [nextCategories, nextRecords, nextAiConfigs, nextShares] = await Promise.all([
        api('/api/categories'),
        api('/api/records'),
        api('/api/ai-configs'),
        api('/api/shares'),
      ]);
      setCategories(nextCategories);
      setRecords(nextRecords);
      setAiConfigs(nextAiConfigs);
      setSharesList(nextShares);
      if (!recordForm.categoryId && nextCategories[0]) {
        setRecordForm((current) => ({ ...current, categoryId: nextCategories[0].id }));
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function reloadAiConfigs() { setAiConfigs(await api('/api/ai-configs')); }
  async function reloadShares() { setSharesList(await api('/api/shares')); }

  async function runJobsOnce() {
    await api('/api/jobs/run', {
      method: 'POST',
      body: JSON.stringify({ limit: 2 }),
    }).catch(() => null);
  }

  function trackJob(job, options = {}) {
    if (!job?.id) return;
    toast(`${options.label || '任务'}已加入队列`);
    runJobsOnce();

    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        const current = await api(`/api/jobs/${job.id}`);
        if (current.status === 'success') {
          window.clearInterval(timer);
          if (options.onSuccess) {
            await options.onSuccess(current);
          }
          toast(`${options.label || '任务'}已完成`);
        } else if (current.status === 'failed') {
          window.clearInterval(timer);
          setError(current.error || `${options.label || '任务'}执行失败`);
        } else if (Date.now() - startedAt > 10 * 60 * 1000) {
          window.clearInterval(timer);
          toast(`${options.label || '任务'}仍在后台处理中，可稍后刷新查看`);
        }
      } catch (jobError) {
        window.clearInterval(timer);
        setError(jobError.message);
      }
    }, 3000);
  }

  useEffect(() => {
    api('/api/session')
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (authenticated) loadCoreData();
  }, [authenticated]);

  async function createCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    setCreatingCategory(true);
    setError('');
    try {
      const category = await api('/api/categories', { method: 'POST', body: JSON.stringify({ name: trimmed }) });
      setCategories((current) => {
        const exists = current.some((item) => item.id === category.id);
        return exists ? current : [...current, category].sort((a, b) => a.name.localeCompare(b.name));
      });
      setActiveCategoryId(category.id);
      setRecordForm((current) => ({ ...current, categoryId: category.id }));
      toast('分类已创建');
      return true;
    } catch (createError) {
      setError(createError.message);
      return false;
    } finally {
      setCreatingCategory(false);
    }
  }

  async function renameCategory(categoryId, newName) {
    setError('');
    try {
      const updated = await api(`/api/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      setCategories((current) =>
        current.map((category) => (category.id === categoryId ? { ...category, name: updated.name } : category)),
      );
      toast('分类已重命名');
    } catch (renameError) {
      setError(renameError.message);
    }
  }

  async function deleteCategory(categoryId, categoryName) {
    if (!window.confirm(`确认删除分类"${categoryName}"？该分类下的记录将变为未分类。`)) return;
    setError('');
    try {
      await api(`/api/categories/${categoryId}`, { method: 'DELETE' });
      setCategories((current) => current.filter((category) => category.id !== categoryId));
      setRecords((current) =>
        current.map((record) => (record.categoryId === categoryId ? { ...record, categoryId: '' } : record)),
      );
      if (activeCategoryId === categoryId) {
        setActiveCategoryId('');
        resetRecordForm('');
      }
      toast('分类已删除');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function resetRecordForm(categoryId = activeCategoryId) {
    setRecordForm({ ...emptyRecord, categoryId: categoryId || categories[0]?.id || '' });
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await api(recordForm.id ? `/api/records/${recordForm.id}` : '/api/records', {
        method: recordForm.id ? 'PUT' : 'POST',
        body: JSON.stringify(recordForm),
      });
      setRecords((current) => {
        const exists = current.some((record) => record.id === saved.id);
        return exists ? current.map((record) => (record.id === saved.id ? saved : record)) : [saved, ...current];
      });
      setRecordForm(normalizeRecord(saved));
      clearDraft(saved.id);
      toast('记录已保存');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!recordForm.id || !window.confirm('确认删除这条记录？')) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/records/${recordForm.id}`, { method: 'DELETE' });
      clearDraft(recordForm.id);
      setRecords((current) => current.filter((record) => record.id !== recordForm.id));
      resetRecordForm();
      toast('记录已删除');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }

  async function batchDeleteRecords() {
    if (!selectedIds.size) return;
    if (!window.confirm(`确认删除选中的 ${selectedIds.size} 条记录？`)) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all([...selectedIds].map((id) => api(`/api/records/${id}`, { method: 'DELETE' })));
      selectedIds.forEach(clearDraft);
      setRecords((current) => current.filter((record) => !selectedIds.has(record.id)));
      setSelectedIds(new Set());
      if (selectedIds.has(recordForm.id)) resetRecordForm();
      toast(`已删除 ${selectedIds.size} 条记录`);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleRecordSelection(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllRecords() {
    if (selectedIds.size === sortedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRecords.map((r) => r.id)));
    }
  }

  async function organizeRecord(aiConfigId) {
    if (!recordForm.id) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await api(`/api/records/${recordForm.id}/organize`, {
        method: 'POST',
        body: JSON.stringify({ aiConfigId }),
      });
      await trackJob(result.job, {
        label: 'AI 整理',
        onSuccess: async (job) => {
          const organized = job.result?.record;
          if (organized) {
            setRecords((current) => current.map((record) => (record.id === organized.id ? organized : record)));
            setRecordForm(normalizeRecord(organized));
          } else {
            await loadCoreData();
          }
        },
      });
    } catch (organizeError) {
      setError(organizeError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function uploadImage(file) {
    if (!file) return;
    setActionLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      const result = await api('/api/images', { method: 'POST', body });
      setRecordForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, result.url],
        markdown: `${current.markdown || ''}\n\n![image](${result.url})`.trim(),
      }));
      toast('图片已上传');
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' }).catch(() => null);
    setAuthenticated(false);
    setRecords([]);
    setCategories([]);
    setAiConfigs([]);
    setSharesList([]);
    setRecordForm(emptyRecord);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="spin h-6 w-6 text-primary" />
      </main>
    );
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  const navItems = [
    { id: 'records', label: '记录', icon: FileText },
    { id: 'web', label: '网页', icon: Globe },
    { id: 'ai', label: 'AI 配置', icon: Bot },
    { id: 'shares', label: '分享', icon: Share2 },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-primary/20">
                R
              </div>
              <h1 className="truncate text-lg font-semibold">RE Save</h1>
            </div>
            <Hitokoto />
          </div>
          <Tabs value={view} onValueChange={setView} className="min-w-0">
            <TabsList className="max-w-[720px] overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.id} value={item.id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)} title="键盘快捷键">
              <Keyboard className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={loadCoreData} title="刷新">
              <RefreshCw className={loading ? 'spin' : ''} />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="退出登录">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1560px] gap-4 overflow-hidden px-4 py-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button>
            </AlertDescription>
          </Alert>
        ) : null}

        {view === 'records' ? (
          <div className="view-fade-in">
            <div className="records-layout">
            <CategoryPanel
              categories={categories}
              activeCategoryId={activeCategoryId}
              recordCounts={recordCounts}
              creating={creatingCategory}
              onCreate={createCategory}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onSelect={(categoryId) => {
                setActiveCategoryId(categoryId);
                resetRecordForm(categoryId);
              }}
            />
            <RecordList
              records={sortedRecords}
              activeId={recordForm.id}
              categoryName={activeCategoryName}
              sortBy={sortBy}
              sortDir={sortDir}
              selectedIds={selectedIds}
              onSort={(field) => {
                if (sortBy === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                else { setSortBy(field); setSortDir('desc'); }
              }}
              onSelect={(record) => setRecordForm(normalizeRecord(record))}
              onToggleSelect={toggleRecordSelection}
              onSelectAll={selectAllRecords}
              onCreate={() => resetRecordForm()}
              onBatchDelete={batchDeleteRecords}
            />
            <RecordEditor
              form={recordForm}
              categories={categories}
              aiConfigs={aiConfigs}
              saving={saving}
              actionLoading={actionLoading}
              onChange={setRecordForm}
              onSave={saveRecord}
              onDelete={deleteRecord}
              onReset={() => resetRecordForm()}
              onOrganize={organizeRecord}
              onUploadImage={uploadImage}
              onShare={() => setShareDialogOpen(true)}
              onExportMarkdown={() => exportRecord('markdown')}
              onExportJson={() => exportRecord('json')}
            />
          </div>
          </div>
        ) : null}

        {view === 'web' ? (
          <div className="view-fade-in">
          <WebCaptureView
            categories={categories}
            aiConfigs={aiConfigs}
            setError={setError}
            onJobCreated={(job) =>
              trackJob(job, {
                label: '网页提取',
                onSuccess: async (doneJob) => {
                  const record = doneJob.result?.record;
                  if (record) {
                    setRecords((current) => [record, ...current]);
                    setRecordForm(normalizeRecord(record));
                    setView('records');
                  } else {
                    await loadCoreData();
                  }
                },
              })
            }
          />
          </div>
        ) : null}

        {view === 'ai' ? <div className="view-fade-in"><AiConfigView aiConfigs={aiConfigs} onReload={reloadAiConfigs} setError={setError} /></div> : null}
        {view === 'shares' ? <div className="view-fade-in"><ShareManageView sharesList={sharesList} onReload={reloadShares} setError={setError} /></div> : null}
      </div>

      <ShareDialog
        open={shareDialogOpen}
        record={recordForm}
        onClose={() => setShareDialogOpen(false)}
        onChanged={reloadShares}
        setError={setError}
      />

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              键盘快捷键
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            {[
              ['Ctrl+S', '保存记录'],
              ['Ctrl+N', '新建记录'],
              ['Ctrl+D', '删除记录'],
              ['Ctrl+F', '聚焦搜索框'],
              ['Ctrl+Shift+S', '分享记录'],
              ['Ctrl+Shift+E', '导出 Markdown'],
              ['Ctrl+Shift+J', '导出 JSON'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <ToastContainer />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
