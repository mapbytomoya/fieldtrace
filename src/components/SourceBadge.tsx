import type { ValueSource } from '../types';
import { SOURCE_LABEL } from '../lib/derive';

export function SourceBadge({ source }: { source: ValueSource }) {
  return <span className={`badge badge-${source}`}>{SOURCE_LABEL[source]}</span>;
}
