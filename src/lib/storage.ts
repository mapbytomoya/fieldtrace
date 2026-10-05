import type { EventInfo, MediaRecord, SavedState } from '../types';

const KEY = 'fieldtrace:v1';

export const emptyEvent: EventInfo = {
  name: '',
  venueName: '',
  date: '',
  venueLat: null,
  venueLng: null,
  description: '',
};

export function buildState(event: EventInfo, items: MediaRecord[]): SavedState {
  return { app: 'FieldTrace', version: 1, event, items };
}

/** 保存結果。サムネイルを含めると容量超過する場合はサムネイルを除いて保存する。 */
export function saveState(state: SavedState): 'ok' | 'without-thumbnails' | 'failed' {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return 'ok';
  } catch {
    try {
      const slim = { ...state, items: state.items.map((i) => ({ ...i, thumbnail: null })) };
      localStorage.setItem(KEY, JSON.stringify(slim));
      return 'without-thumbnails';
    } catch {
      return 'failed';
    }
  }
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parseState(JSON.parse(raw));
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** JSON の読み込み時に最低限の形を検証する。 */
export function parseState(data: unknown): SavedState | null {
  if (!isObj(data) || data.app !== 'FieldTrace' || !isObj(data.event) || !Array.isArray(data.items)) return null;
  const e = data.event;
  const event: EventInfo = {
    name: str(e.name),
    venueName: str(e.venueName),
    date: str(e.date),
    venueLat: numOrNull(e.venueLat),
    venueLng: numOrNull(e.venueLng),
    description: str(e.description),
  };
  const items: MediaRecord[] = [];
  for (const raw of data.items) {
    if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.fileName !== 'string') continue;
    if (!isObj(raw.meta) || !isObj(raw.manual)) continue;
    items.push(raw as unknown as MediaRecord);
  }
  return { app: 'FieldTrace', version: 1, event, items };
}
