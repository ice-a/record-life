import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, FileText, Globe, Plus, Search, Trash2 } from 'lucide-react';
import { useDebounce } from '@/lib/hooks';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RecordList({
  records,
  activeId,
  categoryName,
  sortBy,
  sortDir,
  selectedIds,
  onSort,
  onSelect,
  onToggleSelect,
  onSelectAll,
  onCreate,
  onBatchDelete,
}) {
  const [localQuery, setLocalQuery] = useState('');
  const debouncedQuery = useDebounce(localQuery, 250);

  const displayRecords = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => {
      const haystack = [record.title, record.summary, record.content, record.markdown, record.url, record.sourceType, ...(record.tags || [])].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [debouncedQuery, records]);

  const hasSelection = selectedIds.size > 0;

  return (
    <Card className="min-h-0">
      <CardHeader>
        <SectionHeader
          eyebrow="记录"
          title={categoryName}
          action={
            <div className="flex items-center gap-1">
              {hasSelection ? (
                <Button variant="destructive" size="sm" onClick={onBatchDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  删除 {selectedIds.size}
                </Button>
              ) : null}
              <Button onClick={onCreate}>
                <Plus />
                新建
              </Button>
            </div>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="搜索标题、内容、URL 或标签 (Ctrl+F)"
          />
          {localQuery ? (
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
              {displayRecords.length}/{records.length}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={displayRecords.length > 0 && selectedIds.size === displayRecords.length}
            onCheckedChange={onSelectAll}
          />
          <Select value={sortBy} onValueChange={(v) => onSort(v)}>
            <SelectTrigger className="h-7 w-auto text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">按时间</SelectItem>
              <SelectItem value="priority">按优先级</SelectItem>
              <SelectItem value="title">按标题</SelectItem>
            </SelectContent>
          </Select>
          <button type="button" onClick={() => onSort(sortBy)} className="flex items-center gap-0.5 hover:text-foreground">
            {sortDir === 'desc' ? <CalendarArrowDown className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
            {sortDir === 'desc' ? '降序' : '升序'}
          </button>
        </div>
        <div className="scroll-list mt-3 grid gap-3">
          {displayRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {localQuery ? '没有匹配的记录' : '暂无记录'}
            </div>
          ) : (
            displayRecords.map((record) => (
              <div
                key={record.id}
                className={`group rounded-lg border bg-card p-4 transition hover:border-primary/60 hover:shadow-sm ${activeId === record.id ? 'border-primary shadow-sm' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={() => onToggleSelect(record.id)}
                    />
                  </div>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => onSelect(record)}
                  >
                    <div className="flex items-center gap-2">
                      {record.sourceType === 'web' ? <Globe className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                      <strong className="truncate text-sm">{record.title}</strong>
                    </div>
                    <p className="two-line mt-2 text-sm text-muted-foreground">
                      {record.summary || record.markdown || record.content || '无摘要'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>优先级 {record.priority || 3}</span>
                      <span>{record.updatedAt ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(record.updatedAt)) : ''}</span>
                    </div>
                    {record.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {record.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
