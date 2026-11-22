import { useState } from 'react';

import { STICKERS, type StickerKey } from '@/lib/stickers';

const sheet = new URL('../../assets/kfc-sticker-sheet.webp', import.meta.url).href;

export function MascotSticker({ sticker, moving = false }: { sticker: StickerKey; moving?: boolean }) {
  return <span
    className={`mascot-sprite mascot-${sticker}${moving ? ' mascot-moving' : ''}`}
    style={{ backgroundImage: `url("${sheet}")` }}
    aria-hidden="true"
  />;
}

export function MascotMessage({ sticker }: { sticker: StickerKey }) {
  const [replay, setReplay] = useState(0);
  return <button type="button" className="mascot-message" onClick={() => setReplay(value => value + 1)}
    aria-label={`${STICKERS[sticker]} 마스코트 이모티콘 다시 재생`} title="모션 다시 재생">
    <MascotSticker key={replay} sticker={sticker} moving />
  </button>;
}
