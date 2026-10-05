import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng, PickMode } from '../types';
import type { ResolvedItem } from '../lib/derive';
import { CATEGORY_LABEL } from '../lib/derive';
import { formatCoord, formatDistance } from '../lib/geo';
import { formatDateTime } from '../lib/format';
import { MediaPreview } from './MediaPreview';
import { SourceBadge } from './SourceBadge';

interface Props {
  items: ResolvedItem[];
  urls: Record<string, string>;
  venue: LatLng | null;
  venueName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  pickMode: PickMode;
  onPick: (p: LatLng) => void;
  onCancelPick: () => void;
}

const DEFAULT_CENTER: [number, number] = [36.2, 138.25];

function numberIcon(n: number, selected: boolean, manual: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="marker${selected ? ' marker-selected' : ''}${manual ? ' marker-manual' : ''}">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

const venueIcon = L.divIcon({
  className: '',
  html: '<div class="marker-venue"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

export function MapView(props: Props) {
  const { items, urls, venue, venueName, selectedId, onSelect, pickMode, onPick, onCancelPick } = props;
  const located = items.filter((i) => i.location);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  // 撮影日時と位置の両方がある地点だけを時系列で結ぶ
  const route = located
    .filter((i) => i.epoch !== null)
    .map((i) => [i.location!.lat, i.location!.lng] as [number, number]);
  const undatedCount = located.filter((i) => i.epoch === null).length;

  return (
    <div className="map-wrap">
      <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom className={`map${pickMode ? ' map-picking' : ''}`}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {route.length >= 2 && (
          <Polyline positions={route} pathOptions={{ color: '#13706d', weight: 2.5, dashArray: '6 6', opacity: 0.9 }} />
        )}
        {venue && (
          <Marker position={[venue.lat, venue.lng]} icon={venueIcon} zIndexOffset={-100}>
            <Popup>
              <div className="popup">
                <div className="popup-title">会場{venueName ? `: ${venueName}` : ''}</div>
                <div className="popup-row">{formatCoord(venue)}（イベント情報で入力）</div>
              </div>
            </Popup>
          </Marker>
        )}
        {located.map((item) => (
          <Marker
            key={item.record.id}
            position={[item.location!.lat, item.location!.lng]}
            icon={numberIcon(item.order, item.record.id === selectedId, item.locationSource === 'manual')}
            zIndexOffset={item.record.id === selectedId ? 1000 : 0}
            ref={(m) => {
              markerRefs.current[item.record.id] = m;
            }}
            eventHandlers={{ click: () => onSelect(item.record.id) }}
          >
            <Popup maxWidth={280} minWidth={240}>
              <ItemPopup item={item} url={urls[item.record.id]} />
            </Popup>
          </Marker>
        ))}
        <MapController items={located} venue={venue} selectedId={selectedId} markerRefs={markerRefs} />
        <PickHandler active={pickMode !== null} onPick={onPick} />
      </MapContainer>
      {pickMode && (
        <div className="map-pickbar no-print">
          <span>{pickMode.type === 'venue' ? '会場の位置' : '撮影位置（手動入力）'}を地図上でクリックしてください。</span>
          <button type="button" className="btn btn-small" onClick={onCancelPick}>
            キャンセル
          </button>
        </div>
      )}
      <div className="map-legend">
        {located.length > 0 && (
          <span>
            <span className="legend-marker">1</span> 撮影地点（数字は撮影日時順）
          </span>
        )}
        {venue && (
          <span>
            <span className="legend-venue" /> 会場
          </span>
        )}
        {route.length >= 2 && (
          <span>
            <span className="legend-line" /> 撮影地点を日時順に結んだ直線。実際の移動経路ではありません
          </span>
        )}
        {undatedCount > 0 && <span>撮影日時のない{undatedCount}地点は線で結んでいません</span>}
      </div>
    </div>
  );
}

function ItemPopup({ item, url }: { item: ResolvedItem; url: string | undefined }) {
  const r = item.record;
  return (
    <div className="popup">
      <MediaPreview record={r} url={url} compact />
      <div className="popup-title">
        {item.order}. {r.title || r.fileName}
      </div>
      <dl className="popup-dl">
        <dt>撮影日時</dt>
        <dd>
          {formatDateTime(item.takenAt)} <SourceBadge source={item.takenAtSource} />
        </dd>
        <dt>緯度・経度</dt>
        <dd>
          {item.location ? formatCoord(item.location) : '—'} <SourceBadge source={item.locationSource} />
        </dd>
        {item.distanceM !== null && (
          <>
            <dt>会場から</dt>
            <dd>{formatDistance(item.distanceM)}（直線距離）</dd>
          </>
        )}
        {r.category && (
          <>
            <dt>分類</dt>
            <dd>{CATEGORY_LABEL[r.category]}（記録者が設定）</dd>
          </>
        )}
        {r.note && (
          <>
            <dt>メモ</dt>
            <dd className="pre">{r.note}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function MapController({
  items,
  venue,
  selectedId,
  markerRefs,
}: {
  items: ResolvedItem[];
  venue: LatLng | null;
  selectedId: string | null;
  markerRefs: RefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  const points = useMemo(() => {
    const p = items.map((i) => L.latLng(i.location!.lat, i.location!.lng));
    if (venue) p.push(L.latLng(venue.lat, venue.lng));
    return p;
  }, [items, venue]);
  const boundsKey = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // 全地点が入るように表示範囲を調整
  useEffect(() => {
    fitAll(map, pointsRef.current);
  }, [map, boundsKey]);

  // 選択された地点へ移動してポップアップを開く
  useEffect(() => {
    if (!selectedId) return;
    const marker = markerRefs.current?.[selectedId];
    if (!marker) return;
    const target = marker.getLatLng();
    const zoom = Math.max(map.getZoom(), 16);
    map.flyTo(target, zoom, { duration: 0.4 });
    map.once('moveend', () => marker.openPopup());
  }, [selectedId, map, markerRefs]);

  // 印刷時は地図サイズが変わるため再計算
  useEffect(() => {
    const onPrint = () => {
      map.closePopup();
      map.invalidateSize();
      fitAll(map, pointsRef.current, false);
    };
    window.addEventListener('beforeprint', onPrint);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);

  // 外部から「全地点を表示」を呼べるようにする
  useEffect(() => {
    const handler = () => {
      map.closePopup();
      fitAll(map, pointsRef.current);
    };
    window.addEventListener('fieldtrace:fit', handler);
    return () => window.removeEventListener('fieldtrace:fit', handler);
  }, [map]);

  return null;
}

function fitAll(map: L.Map, points: L.LatLng[], animate = true) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView(points[0], 16, { animate });
    return;
  }
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17, animate });
}

function PickHandler({ active, onPick }: { active: boolean; onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}
