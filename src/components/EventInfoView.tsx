import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { EventInfo, LatLng } from '../types';
import { formatCoord, isValidLat, isValidLng } from '../lib/geo';

export function EventSummary({ event }: { event: EventInfo }) {
  const venue = event.venueLat !== null && event.venueLng !== null ? { lat: event.venueLat, lng: event.venueLng } : null;
  const empty = !event.name && !event.venueName && !event.date && !venue && !event.description;
  if (empty) return <p className="event-empty">イベント情報は未入力です。</p>;
  return (
    <div className="event-summary">
      <h1 className="event-name">{event.name || '（イベント名未入力）'}</h1>
      <dl className="event-meta">
        <div>
          <dt>会場</dt>
          <dd>{event.venueName || '—'}</dd>
        </div>
        <div>
          <dt>開催日</dt>
          <dd>{event.date ? event.date.replace(/-/g, '/') : '—'}</dd>
        </div>
        <div>
          <dt>会場の緯度・経度</dt>
          <dd>{venue ? formatCoord(venue) : '未入力'}</dd>
        </div>
      </dl>
      {event.description && <p className="event-desc pre">{event.description}</p>}
    </div>
  );
}

interface EditorProps {
  event: EventInfo;
  onChange: (e: EventInfo) => void;
  onClose: () => void;
  onPickVenue: () => void;
  pickedVenue: LatLng | null;
}

export function EventEditor({ event, onChange, onClose, onPickVenue, pickedVenue }: EditorProps) {
  const [draft, setDraft] = useState(event);
  const [lat, setLat] = useState(event.venueLat?.toString() ?? '');
  const [lng, setLng] = useState(event.venueLng?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pickedVenue) {
      setLat(pickedVenue.lat.toFixed(6));
      setLng(pickedVenue.lng.toFixed(6));
    }
  }, [pickedVenue]);

  const set = <K extends keyof EventInfo>(k: K, v: EventInfo[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    let venueLat: number | null = null;
    let venueLng: number | null = null;
    if (lat.trim() || lng.trim()) {
      venueLat = Number(lat);
      venueLng = Number(lng);
      if (!lat.trim() || !lng.trim() || !isValidLat(venueLat) || !isValidLng(venueLng)) {
        setError('緯度は -90〜90、経度は -180〜180 の数値で、両方入力してください。');
        return;
      }
    }
    onChange({ ...draft, venueLat, venueLng });
    onClose();
  };

  return (
    <form className="form event-form no-print" onSubmit={save}>
      <div className="form-grid">
        <label className="field">
          <span>イベント名</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>会場名</span>
          <input value={draft.venueName} onChange={(e) => set('venueName', e.target.value)} />
        </label>
        <label className="field">
          <span>開催日</span>
          <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </label>
        <div className="field">
          <span>会場の緯度・経度</span>
          <div className="field-row">
            <input inputMode="decimal" aria-label="会場の緯度" placeholder="緯度" value={lat} onChange={(e) => setLat(e.target.value)} />
            <input inputMode="decimal" aria-label="会場の経度" placeholder="経度" value={lng} onChange={(e) => setLng(e.target.value)} />
            <button type="button" className="btn btn-small" onClick={onPickVenue}>
              地図をクリックして指定
            </button>
          </div>
        </div>
        <label className="field span-2">
          <span>記録についての説明</span>
          <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary">
          保存
        </button>
        <button type="button" className="btn" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
