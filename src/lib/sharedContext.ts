import { createContext } from 'react';

/** 共有リンクから表示しているとき true（ファイル本体の代わりに共有画像を使う）。 */
export const SharedContext = createContext(false);
