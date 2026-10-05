import { useContext, useEffect, useState } from 'react';
import { SharedContext } from '../lib/sharedContext';
import type { MediaRecord } from '../types';
import { isHeic } from '../lib/metadata';

interface Props {
  record: MediaRecord;
  url: string | undefined;
  compact?: boolean;
}

export function MediaPreview({ record, url, compact }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const alt = record.title || record.fileName;
  const cls = `preview${compact ? ' preview-compact' : ''}`;
  const shared = useContext(SharedContext);

  if (shared) {
    // 共有データ: url は縮小画像または動画の代表フレーム
    const src = url ?? record.thumbnail;
    return (
      <div className={cls}>
        {src ? <img src={src} alt={alt} /> : <div className="preview-empty">プレビューなし</div>}
        {!src ? (
          <p className="preview-msg">写真・動画はこの共有リンクに含まれていません（記録データのみ）。</p>
        ) : record.kind === 'video' ? (
          <p className="preview-msg">動画の代表フレームです。動画本体は共有されていません。</p>
        ) : !url ? (
          <p className="preview-msg">サムネイルのみ共有されています。</p>
        ) : null}
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cls}>
        {record.thumbnail ? (
          <img src={record.thumbnail} alt={alt} />
        ) : (
          <div className="preview-empty">プレビューなし</div>
        )}
        <p className="preview-msg">
          ファイル本体は保存されていません。同じファイルを再度選択すると{record.kind === 'video' ? '再生' : '表示'}できます。
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={cls}>
        {record.thumbnail && <img src={record.thumbnail} alt={alt} />}
        <div className="preview-error" role="alert">
          {record.kind === 'video' ? <VideoError /> : isHeic(record.fileName, record.mimeType) ? <HeicError /> : <ImageError />}
        </div>
      </div>
    );
  }

  return (
    <div className={cls}>
      {record.kind === 'video' ? (
        <video
          key={url}
          src={url}
          controls
          playsInline
          preload="metadata"
          poster={record.thumbnail ?? undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        <img key={url} src={url} alt={alt} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function HeicError() {
  return (
    <>
      <strong>このブラウザではHEIC画像を表示できません。</strong>
      <span>
        撮影日時・位置情報の読み取りは画像の表示とは別に行います。画像を表示するには、Safariで開くか、JPEGに変換したファイルを読み込んでください
        （例: Macの「プレビュー」で書き出し、またはiPhoneの 設定 &gt; カメラ &gt; フォーマット &gt;「互換性優先」で撮影）。
      </span>
    </>
  );
}

function VideoError() {
  return (
    <>
      <strong>この動画はブラウザで再生できません。</strong>
      <span>
        HEVC（H.265）などブラウザが対応していない形式か、ファイルが破損している可能性があります。Safariで開くか、H.264（MP4）に変換したファイルを読み込んでください。
      </span>
    </>
  );
}

function ImageError() {
  return (
    <>
      <strong>この画像を表示できません。</strong>
      <span>ファイルが破損しているか、ブラウザが対応していない形式です。</span>
    </>
  );
}
