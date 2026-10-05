// MOV / MP4 (ISO BMFF) から撮影日時と位置情報を読み取る最小限のパーサ。
// iPhone の動画は moov/meta (keys + ilst) に
//   com.apple.quicktime.location.ISO6709
//   com.apple.quicktime.creationdate
// を保存する。古い形式では moov/udta/©xyz に位置情報が入る。

import type { DateTimeValue, LatLng } from '../types';

export interface QuickTimeResult {
  creationDate: DateTimeValue | null;
  creationDateTag: string | null;
  location: LatLng | null;
  locationTag: string | null;
  make: string | null;
  model: string | null;
}

interface Box {
  type: string;
  start: number; // ボックス本体（ヘッダ後）の開始位置
  end: number;
}

const MAX_MOOV_BYTES = 64 * 1024 * 1024;

function fourcc(view: DataView, offset: number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function readBoxes(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    const type = fourcc(view, pos + 4);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(view.getBigUint64(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) break;
    boxes.push({ type, start: pos + header, end: pos + size });
    pos += size;
  }
  return boxes;
}

async function findMoov(file: File): Promise<DataView | null> {
  let pos = 0;
  const total = file.size;
  while (pos + 8 <= total) {
    const head = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let size = head.getUint32(0);
    const type = fourcc(head, 4);
    let header = 8;
    if (size === 1) {
      size = Number(head.getBigUint64(8));
      header = 16;
    } else if (size === 0) {
      size = total - pos;
    }
    if (size < header) return null;
    if (type === 'moov') {
      if (size > MAX_MOOV_BYTES) return null;
      const buf = await file.slice(pos, pos + size).arrayBuffer();
      // ヘッダ部分は除いた本体を返す
      return new DataView(buf, header);
    }
    pos += size;
  }
  return null;
}

/** ISO 6709 文字列 (例: "+35.6581+139.7414+040.000/") を緯度経度に変換。 */
export function parseIso6709(text: string): LatLng | null {
  const m = text.trim().match(/^([+-])(\d+(?:\.\d+)?)([+-])(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = toDegrees(m[2], 2) * (m[1] === '-' ? -1 : 1);
  const lng = toDegrees(m[4], 3) * (m[3] === '-' ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** 度 / 度分 / 度分秒 形式を十進度に変換。degDigits は度の桁数（緯度2・経度3）。 */
function toDegrees(raw: string, degDigits: number): number {
  const [intPart, frac = ''] = raw.split('.');
  const fraction = frac ? Number('0.' + frac) : 0;
  if (intPart.length <= degDigits) return Number(intPart) + fraction;
  if (intPart.length === degDigits + 2) {
    const d = Number(intPart.slice(0, degDigits));
    const m = Number(intPart.slice(degDigits)) + fraction;
    return d + m / 60;
  }
  if (intPart.length === degDigits + 4) {
    const d = Number(intPart.slice(0, degDigits));
    const m = Number(intPart.slice(degDigits, degDigits + 2));
    const s = Number(intPart.slice(degDigits + 2)) + fraction;
    return d + m / 60 + s / 3600;
  }
  return NaN;
}

/** "2024-05-01T10:23:11+0900" などを壁時計時刻とオフセットに分解。 */
export function parseIsoDate(text: string): DateTimeValue | null {
  const m = text
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}`;
  let offset: string | null = null;
  if (m[7]) {
    if (m[7] === 'Z') offset = '+00:00';
    else {
      const o = m[7].replace(':', '');
      offset = `${o.slice(0, 3)}:${o.slice(3, 5)}`;
    }
  }
  return { local, offset };
}

const decoder = new TextDecoder('utf-8');

function readText(view: DataView, start: number, end: number): string {
  return decoder.decode(new Uint8Array(view.buffer, view.byteOffset + start, end - start)).replace(/\0+$/, '');
}

function parseMetaKeys(view: DataView, meta: Box): Map<string, string> {
  const result = new Map<string, string>();
  // QuickTime の meta は通常のボックス、MP4 の meta は version/flags 付き (full box)
  let start = meta.start;
  if (meta.end - start >= 12 && fourcc(view, start + 4) !== 'hdlr' && fourcc(view, start + 8) === 'hdlr') {
    start += 4;
  }
  const children = readBoxes(view, start, meta.end);
  const keysBox = children.find((b) => b.type === 'keys');
  const ilst = children.find((b) => b.type === 'ilst');
  if (!keysBox || !ilst) return result;

  const keys: string[] = [];
  let p = keysBox.start + 4;
  const count = view.getUint32(p);
  p += 4;
  for (let i = 0; i < count && p + 8 <= keysBox.end; i++) {
    const size = view.getUint32(p);
    if (size < 8 || p + size > keysBox.end) break;
    keys.push(readText(view, p + 8, p + size));
    p += size;
  }

  for (const item of readBoxes(view, ilst.start, ilst.end)) {
    // item の type は keys の 1 始まりインデックス（32bit 整数）
    const index = view.getUint32(item.start - 4);
    const key = keys[index - 1];
    if (!key) continue;
    const data = readBoxes(view, item.start, item.end).find((b) => b.type === 'data');
    if (!data || data.end - data.start < 8) continue;
    const typeCode = view.getUint32(data.start) & 0xffffff;
    // 1 = UTF-8 文字列
    if (typeCode === 1) result.set(key, readText(view, data.start + 8, data.end));
  }
  return result;
}

function parseUdta(view: DataView, udta: Box): Map<string, string> {
  const result = new Map<string, string>();
  for (const b of readBoxes(view, udta.start, udta.end)) {
    if (b.type.charCodeAt(0) === 0xa9 && b.end - b.start > 4) {
      const len = view.getUint16(b.start);
      const textEnd = Math.min(b.end, b.start + 4 + len);
      result.set(b.type, readText(view, b.start + 4, textEnd));
    }
  }
  return result;
}

function parseMvhd(view: DataView, mvhd: Box): Date | null {
  const version = view.getUint8(mvhd.start);
  const secs = version === 1 ? Number(view.getBigUint64(mvhd.start + 4)) : view.getUint32(mvhd.start + 4);
  if (!secs) return null;
  // 1904-01-01 UTC 起点
  const ms = (secs - 2082844800) * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1990) return null;
  return d;
}

function dateToLocalValue(d: Date): DateTimeValue {
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return { local, offset: `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}` };
}

export async function readQuickTimeMetadata(file: File): Promise<QuickTimeResult> {
  const result: QuickTimeResult = {
    creationDate: null,
    creationDateTag: null,
    location: null,
    locationTag: null,
    make: null,
    model: null,
  };
  const moov = await findMoov(file);
  if (!moov) return result;

  const top = readBoxes(moov, 0, moov.byteLength);
  const metaBox = top.find((b) => b.type === 'meta');
  const udtaBox = top.find((b) => b.type === 'udta');
  const mvhdBox = top.find((b) => b.type === 'mvhd');

  const keys = metaBox ? parseMetaKeys(moov, metaBox) : new Map<string, string>();
  const udta = udtaBox ? parseUdta(moov, udtaBox) : new Map<string, string>();

  const iso = keys.get('com.apple.quicktime.location.ISO6709');
  if (iso) {
    result.location = parseIso6709(iso);
    if (result.location) result.locationTag = 'QuickTime com.apple.quicktime.location.ISO6709';
  }
  if (!result.location) {
    const xyz = udta.get('©xyz');
    if (xyz) {
      result.location = parseIso6709(xyz);
      if (result.location) result.locationTag = 'QuickTime udta ©xyz';
    }
  }

  const cd = keys.get('com.apple.quicktime.creationdate');
  if (cd) {
    result.creationDate = parseIsoDate(cd);
    if (result.creationDate) result.creationDateTag = 'QuickTime com.apple.quicktime.creationdate';
  }
  if (!result.creationDate && mvhdBox) {
    const d = parseMvhd(moov, mvhdBox);
    if (d) {
      result.creationDate = dateToLocalValue(d);
      result.creationDateTag = 'QuickTime mvhd 作成時刻（UTCを閲覧端末の時刻帯で表示）';
    }
  }

  result.make = keys.get('com.apple.quicktime.make') ?? udta.get('©mak') ?? null;
  result.model = keys.get('com.apple.quicktime.model') ?? udta.get('©mod') ?? null;
  return result;
}
