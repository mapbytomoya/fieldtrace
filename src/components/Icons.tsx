import type { ReactNode } from 'react';

// 線画アイコン（stroke のみ、24x24 グリッド）
interface Props {
  size?: number;
  title?: string;
}

function Svg({ size = 14, title, children }: Props & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="icon"
    >
      {children}
    </svg>
  );
}

export function PhotoIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M8 6l1.5-2h5L16 6" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function VideoIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </Svg>
  );
}

export function KindIcon({ kind, size }: { kind: 'image' | 'video'; size?: number }) {
  return kind === 'video' ? <VideoIcon size={size} title="動画" /> : <PhotoIcon size={size} title="写真" />;
}
