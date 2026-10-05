import type { ResolvedItem } from '../lib/derive';
import { CATEGORY_LABEL } from '../lib/derive';
import { formatDistance } from '../lib/geo';
import { formatDate, formatTime } from '../lib/format';
import { KindIcon } from './Icons';

interface Props {
  items: ResolvedItem[];
  selectedId: string | null;
  loaded: Record<string, string>;
  onSelect: (id: string) => void;
  showMissing: boolean;
}

export function Timeline({ items, selectedId, loaded, onSelect, showMissing }: Props) {
  let lastDate = '';
  return (
    <ol className="timeline">
      {items.map((item) => {
        const r = item.record;
        // 共有表示では loaded に共有画像が入る
        const thumb = r.thumbnail ?? (showMissing ? null : loaded[r.id]);
        const date = formatDate(item.takenAt);
        const showDate = date !== lastDate;
        lastDate = date;
        return (
          <li key={r.id}>
            <button
              type="button"
              className={`tl-item${r.id === selectedId ? ' tl-selected' : ''}`}
              onClick={() => onSelect(r.id)}
              aria-current={r.id === selectedId}
            >
              <div className="tl-thumb">
                {thumb ? <img src={thumb} alt="" /> : <span>プレビューなし</span>}
                <span className="tl-no">{item.order}</span>
              </div>
              <div className="tl-body">
                <div className="tl-time">
                  <KindIcon kind={r.kind} />
                  {item.takenAt ? (
                    <>
                      {showDate && <span className="tl-date">{date}</span>}
                      <strong>{formatTime(item.takenAt)}</strong>
                    </>
                  ) : (
                    <span className="warn">撮影日時なし</span>
                  )}
                  {item.takenAtSource === 'manual' && <span className="tl-flag">手動入力</span>}
                </div>
                <div className="tl-title">{r.title || r.fileName}</div>
                <div className="tl-place">
                  {!item.location ? (
                    <span className="warn">位置情報なし</span>
                  ) : item.distanceM !== null ? (
                    <>会場から{formatDistance(item.distanceM)}</>
                  ) : (
                    <>位置情報あり</>
                  )}
                  {item.locationSource === 'manual' && <span className="tl-flag">手動入力</span>}
                  {r.category && <span className="tl-cat">{CATEGORY_LABEL[r.category]}</span>}
                </div>
                {r.note && <div className="tl-note">{r.note}</div>}
                {showMissing && !loaded[r.id] && <div className="tl-missing">ファイル未読込</div>}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
