import { useContext } from 'react';
import type { ResolvedItem } from '../lib/derive';
import { SharedContext } from '../lib/sharedContext';
import { CATEGORY_LABEL } from '../lib/derive';
import { formatCoord, formatDistance } from '../lib/geo';
import { formatDateTime } from '../lib/format';
import { SourceBadge } from './SourceBadge';

interface Props {
  items: ResolvedItem[];
  urls: Record<string, string>;
}

/** 印刷時のみ表示されるメディア一覧。 */
export function PrintReport({ items, urls }: Props) {
  const shared = useContext(SharedContext);
  return (
    <section className="print-only print-report">
      <h2 className="section-title">撮影記録一覧（撮影日時順・{items.length}件）</h2>
      {items.map((item) => {
        const r = item.record;
        // 写真は元画像（表示可能な場合）、動画は代表フレームを使用
        const src = shared ? (urls[r.id] ?? r.thumbnail) : r.kind === 'image' && urls[r.id] && r.thumbnail ? urls[r.id] : r.thumbnail;
        return (
          <article key={r.id} className="print-item">
            <div className="print-media">
              {src ? <img src={src} alt="" /> : <div className="preview-empty">プレビューなし</div>}
              {r.kind === 'video' && <div className="small">動画（代表フレーム）</div>}
            </div>
            <dl className="meta-table">
              <dt>No.</dt>
              <dd>
                {item.order}　{r.title || r.fileName}
              </dd>
              <dt>ファイル</dt>
              <dd>
                {r.fileName}（{r.kind === 'video' ? '動画' : '写真'} / {r.extension.toUpperCase()}）
              </dd>
              <dt>撮影日時</dt>
              <dd>
                {item.takenAt ? formatDateTime(item.takenAt) : '取得できませんでした'} <SourceBadge source={item.takenAtSource} />
              </dd>
              <dt>緯度・経度</dt>
              <dd>
                {item.location ? formatCoord(item.location) : '取得できませんでした'} <SourceBadge source={item.locationSource} />
              </dd>
              <dt>会場からの距離</dt>
              <dd>{item.distanceM !== null ? `${formatDistance(item.distanceM)}（直線距離）` : '—'}</dd>
              <dt>分類</dt>
              <dd>{r.category ? `${CATEGORY_LABEL[r.category]}（記録者が設定）` : '未設定'}</dd>
              <dt>読み取り元</dt>
              <dd className="small">
                日時: {r.meta.takenAtTag ?? 'なし'} / 位置: {r.meta.locationTag ?? 'なし'}
              </dd>
              {r.note && (
                <>
                  <dt>メモ</dt>
                  <dd className="pre">{r.note}</dd>
                </>
              )}
            </dl>
          </article>
        );
      })}
    </section>
  );
}
