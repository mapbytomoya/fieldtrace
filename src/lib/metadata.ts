import exifr from 'exifr';
import type { DateTimeValue, FileMetadata, MediaKind } from '../types';
import { readQuickTimeMetadata } from './quicktime';

const IMAGE_EXT = ['jpg', 'jpeg', 'heic', 'heif', 'png'];
const VIDEO_EXT = ['mov', 'mp4', 'm4v'];

export const ACCEPT = '.jpg,.jpeg,.heic,.heif,.png,.mov,.mp4,.m4v,image/jpeg,image/png,image/heic,image/heif,video/quicktime,video/mp4';

export function getExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function detectKind(file: File): MediaKind | null {
  const ext = getExtension(file.name);
  if (VIDEO_EXT.includes(ext) || file.type.startsWith('video/')) return 'video';
  if (IMAGE_EXT.includes(ext) || file.type.startsWith('image/')) return 'image';
  return null;
}

export function isHeic(name: string, mime: string): boolean {
  const ext = getExtension(name);
  return ext === 'heic' || ext === 'heif' || /heic|heif/i.test(mime);
}

function emptyMeta(): FileMetadata {
  return {
    takenAt: null,
    takenAtTag: null,
    location: null,
    locationTag: null,
    accuracyM: null,
    device: null,
    error: null,
  };
}

function normalizeOffset(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
  return m ? `${m[1]}${m[2]}:${m[3]}` : null;
}

/** EXIF の "YYYY:MM:DD HH:mm:ss" 形式（または exifr が返す Date）を変換。 */
function exifDate(v: unknown, offset: string | null): DateTimeValue | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // exifr は EXIF の時刻を閲覧端末のローカル時刻として Date 化するため、ローカル値を取り出す
    const local = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(
      v.getMinutes(),
    )}:${pad(v.getSeconds())}`;
    return { local, offset };
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m || m[1] === '0000') return null;
    return { local: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, offset };
  }
  return null;
}

async function readImageMetadata(file: File): Promise<FileMetadata> {
  const meta = emptyMeta();
  const tags = (await exifr.parse(file, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: false,
    icc: false,
    iptc: false,
    jfif: false,
    ihdr: false,
    reviveValues: false,
  })) as Record<string, unknown> | undefined;

  if (tags) {
    const candidates: [string, string][] = [
      ['DateTimeOriginal', 'OffsetTimeOriginal'],
      ['CreateDate', 'OffsetTimeDigitized'],
      ['ModifyDate', 'OffsetTime'],
    ];
    for (const [tag, offTag] of candidates) {
      const d = exifDate(tags[tag], normalizeOffset(tags[offTag]) ?? normalizeOffset(tags.OffsetTime));
      if (d) {
        meta.takenAt = d;
        meta.takenAtTag = `EXIF ${tag}`;
        break;
      }
    }
    const err = tags.GPSHPositioningError;
    if (typeof err === 'number' && Number.isFinite(err)) meta.accuracyM = err;
    const make = typeof tags.Make === 'string' ? tags.Make.trim() : '';
    const model = typeof tags.Model === 'string' ? tags.Model.trim() : '';
    meta.device = [make, model].filter(Boolean).join(' ') || null;
  }

  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude) &&
      Math.abs(gps.latitude) <= 90 &&
      Math.abs(gps.longitude) <= 180 &&
      !(gps.latitude === 0 && gps.longitude === 0)
    ) {
      meta.location = { lat: gps.latitude, lng: gps.longitude };
      meta.locationTag = 'EXIF GPSLatitude / GPSLongitude';
    }
  } catch {
    // GPS 情報なし
  }
  return meta;
}

async function readVideoMetadata(file: File): Promise<FileMetadata> {
  const meta = emptyMeta();
  const qt = await readQuickTimeMetadata(file);
  meta.takenAt = qt.creationDate;
  meta.takenAtTag = qt.creationDateTag;
  meta.location = qt.location;
  meta.locationTag = qt.locationTag;
  meta.device = [qt.make, qt.model].filter(Boolean).join(' ') || null;
  return meta;
}

export async function readMetadata(file: File, kind: MediaKind): Promise<FileMetadata> {
  try {
    return kind === 'video' ? await readVideoMetadata(file) : await readImageMetadata(file);
  } catch (e) {
    const meta = emptyMeta();
    meta.error = `メタデータを読み取れませんでした（${e instanceof Error ? e.message : String(e)}）`;
    return meta;
  }
}
