import type { LatLng } from '../types';

const EARTH_RADIUS_M = 6371008.8;

/** Haversine 公式による 2 点間の大円距離（m）。 */
export function haversine(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 「約120m」「約1.2km」形式。 */
export function formatDistance(m: number): string {
  if (m < 10) return '10m未満';
  if (m < 1000) return `約${Math.round(m / 10) * 10}m`;
  if (m < 10000) return `約${(m / 1000).toFixed(1)}km`;
  return `約${Math.round(m / 1000)}km`;
}

export function isValidLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isValidLng(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

export function formatCoord(p: LatLng): string {
  return `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
}
