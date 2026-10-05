import { useState } from 'react';
import type { EventInfo, MediaRecord } from '../types';
import type { MediaQuality } from '../lib/share';
import { buildSharePackage, createShareLink, createSrcLink } from '../lib/share';

interface Props {
  event: EventInfo;
  items: MediaRecord[];
  urls: Record<string, string>;
  onClose: () => void;
}

const LONG_LINK = 8000;

export function SharePanel({ event, items, urls, onClose }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [quality, setQuality] = useState<MediaQuality>('medium');
  const [busy, setBusy] = useState(false);
  const [packageNote, setPackageNote] = useState<string | null>(null);
  const [src, setSrc] = useState('');
  const [srcLink, setSrcLink] = useState<string | null>(null);
  const [srcError, setSrcError] = useState<string | null>(null);
  const missing = items.filter((r) => !urls[r.id]).length;

  const makeLink = async () => {
    setLink(await createShareLink(event, items));
  };

  const exportPackage = async () => {
    setBusy(true);
    try {
      const { blob, included, thumbnailOnly } = await buildSharePackage(event, items, urls, quality);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      a.download = `fieldtrace-share-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setPackageNote(
        `${a.download}（${blob.size < 1024 * 1024 ? `${Math.ceil(blob.size / 1024)} KB` : `${(blob.size / 1024 / 1024).toFixed(1)} MB`}）を書き出しました。画像を含めた記録 ${included}件` +
          (thumbnailOnly ? `、サムネイルのみ ${thumbnailOnly}件` : '') +
          '。',
      );
    } finally {
      setBusy(false);
    }
  };

  const makeSrcLink = () => {
    const v = src.trim();
    if (!/^https?:\/\//.test(v) && !/^[\w./-]+\.json$/.test(v)) {
      setSrcError('https:// で始まるURL、または shares/〜.json の形式で入力してください。');
      setSrcLink(null);
      return;
    }
    setSrcError(null);
    setSrcLink(createSrcLink(v));
  };

  return (
    <section className="share-panel no-print" aria-label="共有">
      <div className="share-head">
        <h2 className="section-title">共有</h2>
        <button type="button" className="btn btn-small" onClick={onClose}>
          閉じる
        </button>
      </div>
      <p className="share-warning">
        共有すると、撮影地点の座標・撮影日時・メモ・イベント情報が、リンクを知っている人に見えます。
        写真に写っている人や、自宅周辺の位置が含まれていないか確認してください。
      </p>

      <div className="share-grid">
        <div className="share-col">
          <h3 className="share-title">共有リンク（記録データのみ）</h3>
          <p className="small">
            撮影日時・座標・メモ・イベント情報をリンクに含めます。写真・動画は含まれません。データはどのサーバーにも保存されません。
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={makeLink} disabled={items.length === 0}>
              共有リンクを作成
            </button>
          </div>
          {link && (
            <>
              <CopyField value={link} />
              <p className="small">
                {link.length.toLocaleString()}文字
                {link.length > LONG_LINK && (
                  <span className="warn">
                    {' '}
                    — リンクが長いため、メッセージアプリ等で途中で切れる場合があります。写真付きの共有用ファイルの利用を勧めます。
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        <div className="share-col">
          <h3 className="share-title">写真付きの共有（固定リンク）</h3>
          <ol className="share-steps">
            <li>
              共有用ファイルを書き出します。写真は縮小版、動画は代表フレームを含みます（動画本体は含みません）。
              <div className="btn-row">
                <select value={quality} onChange={(e) => setQuality(e.target.value as MediaQuality)} aria-label="画像サイズ">
                  <option value="large">画像 長辺1600px</option>
                  <option value="medium">画像 長辺1024px</option>
                  <option value="thumbnail">サムネイルのみ</option>
                </select>
                <button type="button" className="btn" onClick={exportPackage} disabled={busy || items.length === 0}>
                  {busy ? '作成中…' : '共有用ファイルを書き出す'}
                </button>
              </div>
              {missing > 0 && (
                <p className="small">
                  {missing}件はファイル本体が読み込まれていないため、サムネイルのみになります。
                </p>
              )}
              {packageNote && <p className="small">{packageNote}</p>}
            </li>
            <li>
              書き出したファイルをWeb上に置きます。例: このアプリのリポジトリの <code>public/shares/</code> に追加する、GitHub Gist
              に置いて Raw のURLを使う。
            </li>
            <li>
              ファイルのURLを入力してリンクを作成します。
              <div className="field-row">
                <input
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  placeholder="例: shares/fieldtrace-share-20261004.json"
                  aria-label="共有用ファイルのURL"
                />
                <button type="button" className="btn" onClick={makeSrcLink}>
                  リンクを作成
                </button>
              </div>
              {srcError && <p className="form-error">{srcError}</p>}
              {srcLink && <CopyField value={srcLink} />}
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="field-row copy-field">
      <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="作成したリンク" />
      <button type="button" className="btn" onClick={copy}>
        {copied ? 'コピーしました' : 'コピー'}
      </button>
      <a className="btn" href={value} target="_blank" rel="noopener noreferrer">
        開いて確認
      </a>
    </div>
  );
}
