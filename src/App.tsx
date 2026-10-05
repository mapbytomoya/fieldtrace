import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventInfo, LatLng, MediaRecord, PickMode } from './types';
import { ACCEPT, detectKind, getExtension, readMetadata } from './lib/metadata';
import { imageThumbnail, videoThumbnail } from './lib/thumbnail';
import { buildState, emptyEvent, loadState, parseState, saveState } from './lib/storage';
import { resolveItems, venueOf } from './lib/derive';
import { MapView } from './components/MapView';
import { DetailPanel } from './components/DetailPanel';
import { Timeline } from './components/Timeline';
import { DropZone } from './components/DropZone';
import { EventEditor, EventSummary } from './components/EventInfoView';
import { PrintReport } from './components/PrintReport';

export const NOTICE =
  'この記録は、写真・動画に保存された撮影日時・位置情報をもとに事後的に可視化したものです。連続的なGPSトラッキング記録ではありません。';

type StorageStatus = 'ok' | 'without-thumbnails' | 'failed';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [initial] = useState(() => loadState());
  const [event, setEvent] = useState<EventInfo>(initial?.event ?? emptyEvent);
  const [items, setItems] = useState<MediaRecord[]>(initial?.items ?? []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editingMedia, setEditingMedia] = useState(false);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [pickedVenue, setPickedVenue] = useState<LatLng | null>(null);
  const [pickedMedia, setPickedMedia] = useState<LatLng | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('ok');
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const jsonInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStorageStatus(saveState(buildState(event, items)));
  }, [event, items]);

  const venue = venueOf(event);
  const resolved = useMemo(() => resolveItems(items, venue), [items, venue?.lat, venue?.lng]); // eslint-disable-line
  const selected = resolved.find((i) => i.record.id === selectedId) ?? resolved[0] ?? null;
  const missingFiles = items.filter((i) => !urls[i.id]).length;
  const noLocation = resolved.filter((i) => !i.location).length;
  const noDate = resolved.filter((i) => !i.takenAt).length;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setEditingMedia(false);
    setPickMode(null);
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const notes: string[] = [];
    let added = 0;
    let relinked = 0;
    let firstNewId: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`読み込み中 ${i + 1}/${files.length}: ${file.name}`);
      const kind = detectKind(file);
      if (!kind) {
        notes.push(`${file.name}: 対応していない形式のため読み込みませんでした。`);
        continue;
      }
      const url = URL.createObjectURL(file);
      const existing = itemsRef.current.find((r) => r.fileName === file.name && r.fileSize === file.size);
      if (existing) {
        // 保存済みの記録にファイル本体を再接続する（メタデータと入力内容はそのまま）
        const old = urlsRef.current[existing.id];
        if (old) URL.revokeObjectURL(old);
        urlsRef.current = { ...urlsRef.current, [existing.id]: url };
        setUrls(urlsRef.current);
        if (!existing.thumbnail) {
          const thumbnail = kind === 'image' ? await imageThumbnail(url) : await videoThumbnail(url);
          if (thumbnail) setItems((prev) => prev.map((r) => (r.id === existing.id ? { ...r, thumbnail } : r)));
        }
        relinked++;
        continue;
      }
      const meta = await readMetadata(file, kind);
      const thumbnail = kind === 'image' ? await imageThumbnail(url) : await videoThumbnail(url);
      const record: MediaRecord = {
        id: newId(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        extension: getExtension(file.name),
        kind,
        addedAt: new Date().toISOString(),
        meta,
        manual: { takenAt: null, location: null },
        title: '',
        note: '',
        category: null,
        thumbnail,
      };
      firstNewId ??= record.id;
      itemsRef.current = [...itemsRef.current, record];
      urlsRef.current = { ...urlsRef.current, [record.id]: url };
      setItems(itemsRef.current);
      setUrls(urlsRef.current);
      added++;
      if (meta.error) notes.push(`${file.name}: ${meta.error}`);
    }
    setProgress(null);
    const summary: string[] = [];
    if (added) summary.push(`${added}件を追加しました。`);
    if (relinked) summary.push(`${relinked}件は登録済みの記録にファイルを再接続しました。`);
    setMessages([...summary, ...notes]);
    if (firstNewId) {
      setSelectedId(firstNewId);
      setEditingMedia(false);
    }
  }, []);

  // ページ全体へのドロップも受け付ける（閲覧モードを除く）
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (viewModeRef.current || !e.dataTransfer) return;
      void addFilesRef.current(Array.from(e.dataTransfer.files));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const updateItem = (id: string, patch: Partial<MediaRecord>) =>
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeItem = (id: string) => {
    const r = items.find((i) => i.id === id);
    if (!r || !window.confirm(`「${r.fileName}」を一覧から削除しますか？（元のファイルは削除されません）`)) return;
    if (urls[id]) URL.revokeObjectURL(urls[id]);
    setUrls(({ [id]: _removed, ...rest }) => rest);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedId(null);
    setEditingMedia(false);
  };

  const startPick = (mode: NonNullable<PickMode>) => {
    setPickMode(mode);
    document.querySelector('.map-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onPick = (p: LatLng) => {
    if (pickMode?.type === 'venue') setPickedVenue({ ...p });
    else if (pickMode?.type === 'media') setPickedMedia({ ...p });
    setPickMode(null);
  };

  const exportJson = () => {
    const data = { ...buildState(event, items), exportedAt: new Date().toISOString(), notice: NOTICE };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.download = `fieldtrace-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importJson = async (file: File) => {
    try {
      const state = parseState(JSON.parse(await file.text()));
      if (!state) {
        setMessages([`${file.name}: FieldTrace の書き出しファイルとして読み込めませんでした。`]);
        return;
      }
      if (items.length > 0 && !window.confirm('現在の記録を、読み込んだJSONの内容で置き換えますか？')) return;
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
      setUrls({});
      setEvent(state.event);
      setItems(state.items);
      setSelectedId(null);
      setEditingMedia(false);
      setMessages([
        `${file.name} から ${state.items.length}件の記録を読み込みました。写真・動画を表示するには、同じファイルを選択し直してください。`,
      ]);
    } catch {
      setMessages([`${file.name}: JSONとして読み込めませんでした。`]);
    }
  };

  const clearAll = () => {
    if (!window.confirm('イベント情報とすべての記録を消去しますか？（元のファイルは削除されません）')) return;
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    setUrls({});
    setItems([]);
    setEvent(emptyEvent);
    setSelectedId(null);
    setMessages([]);
  };

  const step = (delta: number) => {
    if (!selected) return;
    const next = resolved[selected.order - 1 + delta];
    if (next) select(next.record.id);
  };

  return (
    <div className={`app${viewMode ? ' is-view' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">FieldTrace</span>
          <span className="brand-sub">写真・動画の撮影日時と位置情報の記録</span>
        </div>
        <div className="toolbar no-print">
          {!viewMode && (
            <>
              <button type="button" className="btn" onClick={exportJson} disabled={items.length === 0 && !event.name}>
                JSONを書き出す
              </button>
              <button type="button" className="btn" onClick={() => jsonInput.current?.click()}>
                JSONを読み込む
              </button>
              <input
                ref={jsonInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJson(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
          <button type="button" className="btn" onClick={() => window.print()}>
            印刷 / PDF保存
          </button>
          <button
            type="button"
            className={`btn${viewMode ? ' btn-primary' : ''}`}
            onClick={() => {
              setViewMode((v) => !v);
              setEditingEvent(false);
              setEditingMedia(false);
              setPickMode(null);
            }}
          >
            {viewMode ? '編集モードに戻る' : '閲覧モード'}
          </button>
        </div>
      </header>

      <section className="event">
        {editingEvent && !viewMode ? (
          <EventEditor
            event={event}
            onChange={setEvent}
            onClose={() => {
              setEditingEvent(false);
              setPickMode(null);
            }}
            onPickVenue={() => startPick({ type: 'venue' })}
            pickedVenue={pickedVenue}
          />
        ) : (
          <div className="event-row">
            <EventSummary event={event} />
            {!viewMode && (
              <button type="button" className="btn no-print" onClick={() => setEditingEvent(true)}>
                イベント情報を編集
              </button>
            )}
          </div>
        )}
      </section>

      <p className="notice" role="note">
        {NOTICE}
      </p>

      {(progress || messages.length > 0 || storageStatus !== 'ok' || (missingFiles > 0 && !viewMode)) && (
        <div className="messages no-print" aria-live="polite">
          {progress && <p>{progress}</p>}
          {messages.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          {missingFiles > 0 && !viewMode && (
            <p>
              {missingFiles}件はファイル本体が読み込まれていません（ブラウザにはメタデータと入力内容のみ保存されます）。
              表示・再生するには同じファイルを選択し直してください。ファイル名とサイズで照合します。{' '}
              <button type="button" className="btn btn-small" onClick={() => mediaInput.current?.click()}>
                ファイルを選択
              </button>
              <input
                ref={mediaInput}
                type="file"
                multiple
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  void addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
            </p>
          )}
          {storageStatus === 'without-thumbnails' && <p>保存容量が不足したため、サムネイルを除いて保存しました。</p>}
          {storageStatus === 'failed' && <p className="warn">ブラウザへの保存に失敗しました。JSONを書き出して保管してください。</p>}
          {messages.length > 0 && (
            <button type="button" className="btn btn-small" onClick={() => setMessages([])}>
              閉じる
            </button>
          )}
        </div>
      )}

      <main className="main">
        <div className="main-map">
          <MapView
            items={resolved}
            urls={urls}
            venue={venue}
            venueName={event.venueName}
            selectedId={selectedId}
            onSelect={select}
            pickMode={pickMode}
            onPick={onPick}
            onCancelPick={() => setPickMode(null)}
          />
        </div>
        <aside className="main-side">
          {selected ? (
            <DetailPanel
              key={selected.record.id}
              item={selected}
              total={resolved.length}
              url={urls[selected.record.id]}
              venueSet={venue !== null}
              viewMode={viewMode}
              editing={editingMedia}
              onEdit={(v) => {
                setEditingMedia(v);
                setPickedMedia(null);
                if (!v) setPickMode(null);
              }}
              onSave={(patch) => updateItem(selected.record.id, patch)}
              onRemove={() => removeItem(selected.record.id)}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onPickLocation={() => startPick({ type: 'media', id: selected.record.id })}
              pickedLocation={pickedMedia}
              onShowOnMap={() => {
                setSelectedId(null);
                requestAnimationFrame(() => setSelectedId(selected.record.id));
                document.querySelector('.map-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          ) : viewMode ? (
            <p className="empty">記録がありません。</p>
          ) : (
            <DropZone onFiles={addFiles} large />
          )}
        </aside>
      </main>

      <section className="records">
        <div className="records-head">
          <h2 className="section-title">
            撮影記録 {resolved.length}件<span className="muted">（撮影日時順）</span>
          </h2>
          {resolved.length > 0 && (
            <p className="records-stats">
              位置情報なし {noLocation}件 / 撮影日時なし {noDate}件
            </p>
          )}
          {resolved.length > 0 && (
            <button
              type="button"
              className="btn no-print"
              onClick={() => window.dispatchEvent(new Event('fieldtrace:fit'))}
            >
              全地点を地図に表示
            </button>
          )}
        </div>
        {resolved.length > 0 ? (
          <Timeline items={resolved} selectedId={selected?.record.id ?? null} loaded={urls} onSelect={select} />
        ) : (
          <p className="empty">まだ写真・動画が読み込まれていません。</p>
        )}
        {!viewMode && resolved.length > 0 && (
          <div className="records-foot no-print">
            <DropZone onFiles={addFiles} />
            <button type="button" className="btn btn-quiet" onClick={clearAll}>
              すべて消去
            </button>
          </div>
        )}
      </section>

      <PrintReport items={resolved} urls={urls} />

      <footer className="footer">
        <span>地図: © OpenStreetMap contributors</span>
        <span>距離は会場座標との直線距離（Haversine公式）です。</span>
        <span>
          FieldTrace (CC BY 4.0) <a href="https://github.com/mapbytomoya/fieldtrace">github.com/mapbytomoya/fieldtrace</a>
        </span>
        <span className="print-only">出力: FieldTrace / {new Date().toLocaleString('ja-JP')}</span>
      </footer>
    </div>
  );
}
