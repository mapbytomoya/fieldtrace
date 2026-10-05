// 共有リンクと共有用ファイル。サーバーを使わずに記録を渡すための仕組み。
//  - 共有リンク: 記録データ（写真・動画を除く）を圧縮して URL の # 以降に入れる。
//    # 以降はサーバーへ送信されない。
//  - 共有用ファイル: 縮小した写真・動画の代表フレームを含む JSON。Web 上に置き、
//    ?src=<URL> で開く。

import type { EventInfo, MediaRecord, SavedState } from '../types';
import { buildState, parseState, safeImage } from './storage';
import { imageThumbnail, videoThumbnail } from './thumbnail';

export interface SharedData {
  state: SavedState;
  /** id → 表示用画像（data URL）。写真は縮小版、動画は代表フレーム。 */
  media: Record<string, string>;
  source: string;
}

const HASH_PREFIX = '#d=';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function baseUrl(): string {
  return location.origin + location.pathname;
}

/** 記録データのみの共有リンクを作る（写真・動画、サムネイルは含めない）。 */
export async function createShareLink(event: EventInfo, items: MediaRecord[]): Promise<string> {
  const state = buildState(
    event,
    items.map((r) => ({ ...r, thumbnail: null, meta: { ...r.meta, error: null } })),
  );
  const json = new TextEncoder().encode(JSON.stringify(state));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return `${baseUrl()}${HASH_PREFIX}${toBase64Url(packed)}`;
}

export function createSrcLink(src: string): string {
  return `${baseUrl()}?src=${encodeURIComponent(src.trim())}`;
}

export type MediaQuality = 'large' | 'medium' | 'thumbnail';

const QUALITY_SIZE: Record<MediaQuality, number> = { large: 1600, medium: 1024, thumbnail: 0 };

/** 写真の縮小版・動画の代表フレームを含む共有用ファイルを作る。 */
export async function buildSharePackage(
  event: EventInfo,
  items: MediaRecord[],
  urls: Record<string, string>,
  quality: MediaQuality,
): Promise<{ blob: Blob; included: number; thumbnailOnly: number }> {
  const media: Record<string, string> = {};
  let included = 0;
  let thumbnailOnly = 0;
  const size = QUALITY_SIZE[quality];
  for (const r of items) {
    const url = urls[r.id];
    let image: string | null = null;
    if (url && size > 0) {
      image = r.kind === 'video' ? await videoThumbnail(url, size, 0.82) : await imageThumbnail(url, size, 0.82);
    }
    if (image) {
      media[r.id] = image;
      included++;
    } else {
      thumbnailOnly++;
    }
  }
  const data = {
    ...buildState(event, items.map((r) => ({ ...r, meta: { ...r.meta, error: null } }))),
    kind: 'share',
    createdAt: new Date().toISOString(),
    media,
  };
  return { blob: new Blob([JSON.stringify(data)], { type: 'application/json' }), included, thumbnailOnly };
}

function parseShared(data: unknown, source: string): SharedData {
  const state = parseState(data);
  if (!state) throw new Error('FieldTrace の記録として読み込めませんでした。');
  const media: Record<string, string> = {};
  const raw = (data as { media?: unknown }).media;
  if (raw && typeof raw === 'object') {
    for (const r of state.items) {
      const img = safeImage((raw as Record<string, unknown>)[r.id]);
      if (img) media[r.id] = img;
    }
  }
  return { state, media, source };
}

/** 現在の URL が共有リンクかどうか。 */
export function hasShareInUrl(): boolean {
  return location.hash.startsWith(HASH_PREFIX) || new URLSearchParams(location.search).has('src');
}

/** URL から共有データを読み込む。共有リンクでなければ null。 */
export async function loadShareFromUrl(): Promise<SharedData | null> {
  if (location.hash.startsWith(HASH_PREFIX)) {
    let text: string;
    try {
      const bytes = await pipe(fromBase64Url(location.hash.slice(HASH_PREFIX.length)), new DecompressionStream('deflate-raw'));
      text = new TextDecoder().decode(bytes);
    } catch {
      throw new Error('共有リンクが壊れているか、途中で切れています。リンク全体をコピーしてください。');
    }
    return parseShared(JSON.parse(text), '共有リンク');
  }
  const src = new URLSearchParams(location.search).get('src');
  if (src) {
    const url = new URL(src, baseUrl());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('共有用ファイルのURLが正しくありません。');
    let res: Response;
    try {
      res = await fetch(url.href);
    } catch {
      throw new Error(`共有用ファイルを取得できませんでした（${url.href}）。公開設定やURLを確認してください。`);
    }
    if (!res.ok) throw new Error(`共有用ファイルを取得できませんでした（HTTP ${res.status}: ${url.href}）。`);
    return parseShared(await res.json(), url.href);
  }
  return null;
}
