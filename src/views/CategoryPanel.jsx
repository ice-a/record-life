import { useState } from 'react';
import { Check, Edit3, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function CategoryPanel({ categories, activeCategoryId, recordCounts, onSelect, onCreate, onRename, onDelete, creating }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const total = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);

  async function submit(event) {
    event.preventDefault();
    const created = await onCreate(name);
    if (created) setName('');
  }

  function startRename(category) {
    setEditingId(category.id);
    setEditName(category.name);
  }

  async function saveRename() {
    if (!editName.trim()) return;
    await onRename(editingId, editName.trim());
    setEditingId('');
    setEditName('');
  }

  return (
    <Card className="min-h-0">
      <CardHeader>
        <SectionHeader eyebrow="分类" title="内容分组" />
      </CardHeader>
      <CardContent className="flex h-[calc(100%-5rem)] flex-col gap-3">
        <div className="grid gap-1">
          <button
            type="button"
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ${activeCategoryId === '' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
            onClick={() => onSelect('')}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              全部记录
            </span>
            <Badge variant="secondary">{total}</Badge>
          </button>
          <div className="grid gap-0.5 overflow-auto">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`group flex items-center rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 ${activeCategoryId === category.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
              >
                {editingId === category.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename();
                        if (event.key === 'Escape') setEditingId('');
                      }}
                      className="h-7 py-1 text-sm"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveRename}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-between gap-1"
                      onClick={() => onSelect(category.id)}
                    >
                      <span className="truncate">{category.name}</span>
                      <Badge variant="secondary">{recordCounts[category.id] || 0}</Badge>
                    </button>
                    <div className="ml-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startRename(category)} title="重命名">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(category.id, category.name);
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <form className="mt-auto flex gap-2" onSubmit={submit}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="新建分类" />
          <Button size="icon" type="submit" disabled={creating || !name.trim()} title="添加分类">
            <Plus />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
