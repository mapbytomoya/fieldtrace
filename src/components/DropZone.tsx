import { useRef, useState } from 'react';
import { ACCEPT } from '../lib/metadata';

interface Props {
  onFiles: (files: File[]) => void;
  large?: boolean;
}

export function DropZone({ onFiles, large }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone${large ? ' dropzone-large' : ''}${over ? ' dropzone-over' : ''} no-print`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <p className="dropzone-main">写真・動画ファイルをここにドロップ</p>
      <p className="small">対応形式: JPEG / HEIC / PNG / MOV / MP4（複数選択可）</p>
      <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
        ファイルを選択
      </button>
      {large && (
        <p className="small muted">
          ファイルはこのブラウザ内でのみ処理され、サーバーへ送信されません。撮影日時と位置情報はファイル内のメタデータから読み取ります。
        </p>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
