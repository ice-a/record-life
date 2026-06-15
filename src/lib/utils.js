import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const emptyRecord = {
  id: '',
  title: '',
  categoryId: '',
  priority: 3,
  sourceType: 'manual',
  url: '',
  summary: '',
  content: '',
  markdown: '',
  tags: '',
  imageUrls: [],
};

export const emptyAiConfig = {
  id: '',
  name: '',
  provider: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  temperature: '0.2',
  maxTokens: '',
  isDefault: false,
};

export function toTagText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : tags || '';
}

export function normalizeRecord(record) {
  return {
    ...emptyRecord,
    ...record,
    markdown: record.markdown || record.content || '',
    content: record.content || '',
    tags: toTagText(record.tags),
    imageUrls: record.imageUrls || [],
  };
}

export function normalizeAiConfig(config) {
  return {
    ...emptyAiConfig,
    ...config,
    apiKey: '',
    temperature: config.temperature ?? '',
    maxTokens: config.maxTokens ?? '',
  };
}

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
