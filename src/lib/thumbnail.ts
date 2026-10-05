const MAX_SIZE = 320;

function drawToDataUrl(source: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_SIZE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

/** 画像の縮小版を作る。ブラウザが表示できない形式（HEIC など）の場合は null。 */
export function imageThumbnail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(drawToDataUrl(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 動画の代表フレーム（0.5 秒付近）を取得する。再生できない場合は null。 */
export function videoThumbnail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), 10000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(0.5, d / 2);
    };
    video.onseeked = () => finish(drawToDataUrl(video, video.videoWidth, video.videoHeight));
    video.onerror = () => finish(null);
    video.src = url;
  });
}
