import type { DateTimeValue } from '../types';

/** 表示用: "2024-05-01 10:23:11 (UTC+09:00)" */
export function formatDateTime(v: DateTimeValue | null): string {
  if (!v) return '—';
  const [d, t] = v.local.split('T');
  return `${d.replace(/-/g, '/')} ${t}${v.offset ? ` (UTC${v.offset})` : ''}`;
}

export function formatTime(v: DateTimeValue | null): string {
  if (!v) return '—';
  return v.local.split('T')[1]?.slice(0, 5) ?? '—';
}

export function formatDate(v: DateTimeValue | null): string {
  if (!v) return '—';
  return v.local.split('T')[0].replace(/-/g, '/');
}

/** 並べ替え用のエポックミリ秒。オフセット不明の場合は閲覧端末の時刻帯として扱う。 */
export function toEpoch(v: DateTimeValue | null): number | null {
  if (!v) return null;
  const t = Date.parse(v.offset ? `${v.local}${v.offset}` : v.local);
  return Number.isNaN(t) ? null : t;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
