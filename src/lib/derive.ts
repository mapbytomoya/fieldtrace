import type { Category, DateTimeValue, EventInfo, LatLng, MediaRecord, ValueSource } from '../types';
import { haversine } from './geo';
import { toEpoch } from './format';

export interface ResolvedItem {
  record: MediaRecord;
  order: number;
  takenAt: DateTimeValue | null;
  takenAtSource: ValueSource;
  location: LatLng | null;
  locationSource: ValueSource;
  epoch: number | null;
  distanceM: number | null;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  venue: '会場内',
  near: '会場付近',
  moving: '移動中',
  other: 'その他',
};

export const SOURCE_LABEL: Record<ValueSource, string> = {
  metadata: 'メタデータから取得',
  manual: '手動入力',
  none: '未取得',
};

export function venueOf(event: EventInfo): LatLng | null {
  return event.venueLat !== null && event.venueLng !== null ? { lat: event.venueLat, lng: event.venueLng } : null;
}

/** 手動入力値があればそれを、なければメタデータの値を使う。両方ない場合は null。 */
export function resolveItems(items: MediaRecord[], venue: LatLng | null): ResolvedItem[] {
  const list = items.map((record) => {
    const takenAt = record.manual.takenAt ?? record.meta.takenAt;
    const takenAtSource: ValueSource = record.manual.takenAt ? 'manual' : record.meta.takenAt ? 'metadata' : 'none';
    const location = record.manual.location ?? record.meta.location;
    const locationSource: ValueSource = record.manual.location ? 'manual' : record.meta.location ? 'metadata' : 'none';
    return {
      record,
      order: 0,
      takenAt,
      takenAtSource,
      location,
      locationSource,
      epoch: toEpoch(takenAt),
      distanceM: venue && location ? haversine(venue, location) : null,
    };
  });
  // 撮影日時順。日時のないものは末尾に追加順で並べる
  list.sort((a, b) => {
    if (a.epoch !== null && b.epoch !== null) return a.epoch - b.epoch;
    if (a.epoch !== null) return -1;
    if (b.epoch !== null) return 1;
    return a.record.addedAt.localeCompare(b.record.addedAt);
  });
  list.forEach((item, i) => (item.order = i + 1));
  return list;
}
