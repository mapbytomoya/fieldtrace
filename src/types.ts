export type MediaKind = 'image' | 'video';

/** 撮影日時。local はタイムゾーンなしの壁時計時刻 "YYYY-MM-DDTHH:mm:ss"。 */
export interface DateTimeValue {
  local: string;
  /** "+09:00" 形式。不明な場合は null。 */
  offset: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** ファイルから読み取った値。読み取れなかった項目は null のまま。 */
export interface FileMetadata {
  takenAt: DateTimeValue | null;
  takenAtTag: string | null;
  location: LatLng | null;
  locationTag: string | null;
  /** 端末が記録した水平測位誤差 (m)。 */
  accuracyM: number | null;
  device: string | null;
  error: string | null;
}

/** 手動入力値。null の項目はメタデータの値を使う。 */
export interface ManualValues {
  takenAt: DateTimeValue | null;
  location: LatLng | null;
}

export type Category = 'venue' | 'near' | 'moving' | 'other';

export interface MediaRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  kind: MediaKind;
  addedAt: string;
  meta: FileMetadata;
  manual: ManualValues;
  title: string;
  note: string;
  category: Category | null;
  thumbnail: string | null;
}

export interface EventInfo {
  name: string;
  venueName: string;
  date: string;
  venueLat: number | null;
  venueLng: number | null;
  description: string;
}

export interface SavedState {
  app: 'FieldTrace';
  version: 1;
  event: EventInfo;
  items: MediaRecord[];
}

export type ValueSource = 'metadata' | 'manual' | 'none';

export type PickMode = { type: 'venue' } | { type: 'media'; id: string } | null;
