export const STICKERS = {
  wave: '안녕!',
  laugh: '하하!',
  cheer: '파이팅!',
  thumb: '좋았어!',
  heart: '고마워!',
  build: '작업 중!',
} as const;

export type StickerKey = keyof typeof STICKERS;
export const stickerKeys = Object.keys(STICKERS) as StickerKey[];
export function isStickerKey(value: unknown): value is StickerKey {
  return typeof value === 'string' && Object.hasOwn(STICKERS, value);
}
