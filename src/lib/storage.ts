import type { Category, DateTimeValue, EventInfo, FileMetadata, LatLng, MediaRecord, SavedState } from '../types';
import { isValidLat, isValidLng } from './geo';

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
const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, 300) : null);

/** data:image/ で始まる画像だけを受け付ける（共有データは外部由来のため）。 */
export function safeImage(v: unknown): string | null {
  return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}

function dateValue(v: unknown): DateTimeValue | null {
  if (!isObj(v) || typeof v.local !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v.local)) return null;
  const offset = typeof v.offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(v.offset) ? v.offset : null;
  return { local: v.local, offset };
}

function latLng(v: unknown): LatLng | null {
  if (!isObj(v)) return null;
  const lat = numOrNull(v.lat);
  const lng = numOrNull(v.lng);
  return lat !== null && lng !== null && isValidLat(lat) && isValidLng(lng) ? { lat, lng } : null;
}

const CATEGORIES: Category[] = ['venue', 'near', 'moving', 'other'];

function parseRecord(raw: unknown): MediaRecord | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.fileName !== 'string') return null;
  if (!isObj(raw.meta) || !isObj(raw.manual)) return null;
  const m = raw.meta;
  const meta: FileMetadata = {
    takenAt: dateValue(m.takenAt),
    takenAtTag: strOrNull(m.takenAtTag),
    location: latLng(m.location),
    locationTag: strOrNull(m.locationTag),
    accuracyM: numOrNull(m.accuracyM),
    device: strOrNull(m.device),
    error: strOrNull(m.error),
  };
  return {
    id: raw.id.slice(0, 100),
    fileName: raw.fileName.slice(0, 300),
    fileSize: numOrNull(raw.fileSize) ?? 0,
    mimeType: str(raw.mimeType, 100),
    extension: str(raw.extension, 10),
    kind: raw.kind === 'video' ? 'video' : 'image',
    addedAt: str(raw.addedAt, 40),
    meta,
    manual: { takenAt: dateValue(raw.manual.takenAt), location: latLng(raw.manual.location) },
    title: str(raw.title, 300),
    note: str(raw.note),
    category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : null,
    thumbnail: safeImage(raw.thumbnail),
  };
}

/** JSON の読み込み時に形を検証し、想定外の値は捨てる。 */
export function parseState(data: unknown): SavedState | null {
  if (!isObj(data) || data.app !== 'FieldTrace' || !isObj(data.event) || !Array.isArray(data.items)) return null;
  const e = data.event;
  const venueLat = numOrNull(e.venueLat);
  const venueLng = numOrNull(e.venueLng);
  const venueOk = venueLat !== null && venueLng !== null && isValidLat(venueLat) && isValidLng(venueLng);
  const event: EventInfo = {
    name: str(e.name, 300),
    venueName: str(e.venueName, 300),
    date: str(e.date, 20),
    venueLat: venueOk ? venueLat : null,
    venueLng: venueOk ? venueLng : null,
    description: str(e.description),
  };
  const items = data.items.map(parseRecord).filter((r): r is MediaRecord => r !== null);
  return { app: 'FieldTrace', version: 1, event, items };
}
