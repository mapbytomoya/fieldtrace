import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Category, DateTimeValue, LatLng, MediaRecord } from '../types';
import type { ResolvedItem } from '../lib/derive';
import { CATEGORY_LABEL } from '../lib/derive';
import { formatCoord, formatDistance, isValidLat, isValidLng } from '../lib/geo';
import { formatDateTime, formatFileSize } from '../lib/format';
import { MediaPreview } from './MediaPreview';
import { SourceBadge } from './SourceBadge';
import { KindIcon } from './Icons';

interface Props {
  item: ResolvedItem;
  total: number;
  url: string | undefined;
  venueSet: boolean;
  viewMode: boolean;
  editing: boolean;
  onEdit: (editing: boolean) => void;
  onSave: (patch: Partial<MediaRecord>) => void;
  onRemove: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPickLocation: () => void;
  pickedLocation: LatLng | null;
  onShowOnMap: () => void;
}

export function DetailPanel(props: Props) {
  const { item, total, url, venueSet, viewMode, editing } = props;
  const r = item.record;
  return (
    <section className="detail" aria-label="選択中のメディア">
      <div className="detail-head">
        <span className="detail-no">No.{item.order}</span>
        <KindIcon kind={r.kind} />
        <span className="detail-file" title={r.fileName}>
          {r.fileName}
        </span>
        <span className="detail-nav">
          <button type="button" className="btn btn-small" onClick={props.onPrev} disabled={item.order <= 1}>
            前へ
          </button>
          <button type="button" className="btn btn-small" onClick={props.onNext} disabled={item.order >= total}>
            次へ
          </button>
        </span>
      </div>

      <MediaPreview record={r} url={url} />

      {editing && !viewMode ? (
        <EditForm
          item={item}
          onCancel={() => props.onEdit(false)}
          onSave={(patch) => {
            props.onSave(patch);
            props.onEdit(false);
          }}
          onPickLocation={props.onPickLocation}
          pickedLocation={props.pickedLocation}
        />
      ) : (
        <>
          <h2 className="detail-title">{r.title || r.fileName}</h2>
          {item.distanceM !== null ? (
            <p className="distance-line">
              会場から{formatDistance(item.distanceM)}の地点で撮影（直線距離
              {item.locationSource === 'manual' ? '、手動入力の位置による' : ''}）
            </p>
          ) : (
            <p className="distance-line muted">
              {!item.location ? '位置情報がないため、会場からの距離は計算できません。' : !venueSet ? '会場の緯度・経度が未入力のため、距離は計算できません。' : ''}
            </p>
          )}
          <dl className="meta-table">
            <dt>撮影日時</dt>
            <dd>
              {item.takenAt ? formatDateTime(item.takenAt) : '取得できませんでした'} <SourceBadge source={item.takenAtSource} />
            </dd>
            <dt>緯度・経度</dt>
            <dd>
              {item.location ? formatCoord(item.location) : '取得できませんでした'} <SourceBadge source={item.locationSource} />
            </dd>
            {r.meta.accuracyM !== null && item.locationSource === 'metadata' && (
              <>
                <dt>測位誤差</dt>
                <dd>約{Math.round(r.meta.accuracyM)}m（端末の記録値）</dd>
              </>
            )}
            <dt>分類</dt>
            <dd>{r.category ? `${CATEGORY_LABEL[r.category]}（記録者が設定）` : '未設定'}</dd>
            <dt>メモ</dt>
            <dd className="pre">{r.note || '—'}</dd>
            <dt>ファイル形式</dt>
            <dd>
              {r.kind === 'video' ? '動画' : '写真'} / {r.extension.toUpperCase() || '不明'} / {formatFileSize(r.fileSize)}
            </dd>
            {r.meta.device && (
              <>
                <dt>撮影機器</dt>
                <dd>{r.meta.device}</dd>
              </>
            )}
            <dt>読み取り元</dt>
            <dd className="small">
              日時: {r.meta.takenAtTag ?? 'なし'}
              <br />
              位置: {r.meta.locationTag ?? 'なし'}
              {r.meta.error && (
                <>
                  <br />
                  {r.meta.error}
                </>
              )}
            </dd>
            {(r.manual.takenAt || r.manual.location) && (
              <>
                <dt>メタデータの値</dt>
                <dd className="small">
                  {r.manual.takenAt && <>日時: {r.meta.takenAt ? formatDateTime(r.meta.takenAt) : 'なし'}<br /></>}
                  {r.manual.location && <>位置: {r.meta.location ? formatCoord(r.meta.location) : 'なし'}</>}
                </dd>
              </>
            )}
          </dl>
          <div className="detail-actions no-print">
            {item.location && (
              <button type="button" className="btn" onClick={props.onShowOnMap}>
                地図で表示
              </button>
            )}
            {!viewMode && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => props.onEdit(true)}>
                  情報を編集
                </button>
                <button type="button" className="btn btn-quiet" onClick={props.onRemove}>
                  一覧から削除
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function EditForm({
  item,
  onCancel,
  onSave,
  onPickLocation,
  pickedLocation,
}: {
  item: ResolvedItem;
  onCancel: () => void;
  onSave: (patch: Partial<MediaRecord>) => void;
  onPickLocation: () => void;
  pickedLocation: LatLng | null;
}) {
  const r = item.record;
  const [title, setTitle] = useState(r.title);
  const [note, setNote] = useState(r.note);
  const [category, setCategory] = useState<Category | ''>(r.category ?? '');
  const [dt, setDt] = useState(r.manual.takenAt?.local ?? '');
  const [offset, setOffset] = useState(r.manual.takenAt?.offset ?? '');
  const [lat, setLat] = useState(r.manual.location ? String(r.manual.location.lat) : '');
  const [lng, setLng] = useState(r.manual.location ? String(r.manual.location.lng) : '');
  const [error, setError] = useState<string | null>(null);

  // 地図クリックで位置が指定された場合は入力欄へ反映
  useEffect(() => {
    if (pickedLocation) {
      setLat(pickedLocation.lat.toFixed(6));
      setLng(pickedLocation.lng.toFixed(6));
    }
  }, [pickedLocation]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let takenAt: DateTimeValue | null = null;
    if (dt.trim()) {
      const m = dt.trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?/);
      if (!m) return setError('撮影日時の形式が正しくありません。');
      let off: string | null = null;
      if (offset.trim()) {
        const o = offset.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
        if (!o) return setError('UTCオフセットは +09:00 の形式で入力してください。');
        off = `${o[1]}${o[2]}:${o[3]}`;
      }
      takenAt = { local: `${m[1]}${m[2] ?? ':00'}`, offset: off };
    }
    let location: LatLng | null = null;
    if (lat.trim() || lng.trim()) {
      const la = Number(lat);
      const ln = Number(lng);
      if (!lat.trim() || !lng.trim() || !isValidLat(la) || !isValidLng(ln)) {
        return setError('緯度は -90〜90、経度は -180〜180 の数値で、両方入力してください。');
      }
      location = { lat: la, lng: ln };
    }
    onSave({
      title: title.trim(),
      note,
      category: category || null,
      manual: { takenAt, location },
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>タイトル</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={r.fileName} />
      </label>
      <label className="field">
        <span>メモ</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="field">
        <span>分類</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
          <option value="">未設定</option>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="fieldset">
        <legend>撮影日時</legend>
        <p className="small">
          メタデータ: {r.meta.takenAt ? `${formatDateTime(r.meta.takenAt)}（${r.meta.takenAtTag}）` : '取得できませんでした'}
        </p>
        <div className="field-row">
          <label className="field grow">
            <span>手動入力</span>
            <input type="datetime-local" step={1} value={dt} onChange={(e) => setDt(e.target.value)} />
          </label>
          <label className="field w-offset">
            <span>UTCオフセット（任意）</span>
            <input value={offset} onChange={(e) => setOffset(e.target.value)} placeholder="例: +09:00" />
          </label>
        </div>
        {dt && (
          <button type="button" className="btn btn-small" onClick={() => (setDt(''), setOffset(''))}>
            手動入力を消去{r.meta.takenAt ? 'してメタデータの値に戻す' : ''}
          </button>
        )}
      </fieldset>

      <fieldset className="fieldset">
        <legend>位置情報</legend>
        <p className="small">
          メタデータ: {r.meta.location ? `${formatCoord(r.meta.location)}（${r.meta.locationTag}）` : '取得できませんでした'}
        </p>
        <div className="field-row">
          <label className="field grow">
            <span>緯度（手動入力）</span>
            <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="例: 35.681236" />
          </label>
          <label className="field grow">
            <span>経度（手動入力）</span>
            <input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="例: 139.767125" />
          </label>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-small" onClick={onPickLocation}>
            地図をクリックして指定
          </button>
          {(lat || lng) && (
            <button type="button" className="btn btn-small" onClick={() => (setLat(''), setLng(''))}>
              手動入力を消去{r.meta.location ? 'してメタデータの値に戻す' : ''}
            </button>
          )}
        </div>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary">
          保存
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
