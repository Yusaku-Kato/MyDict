export const READING_PATTERN = /^[ぁ-ゖー\s]+$/u;

/** カタカナをひらがなに変換する（読み方入力の補助） */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export const collator = new Intl.Collator('ja');

export const ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'] as const;
const ROW_STARTS = 'あかさたなはまやらわ';
const SMALL: Record<string, string> = { ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゕ: 'か', ゖ: 'け' };

/** 読み方の先頭文字から五十音の行（あ・か・さ…）を返す。 */
export function rowOf(reading: string): string {
  let c = reading.trim().charAt(0).normalize('NFD').charAt(0); // 濁点・半濁点を除去
  c = SMALL[c] ?? c;
  if (c === 'ゔ') c = 'う';
  if (c === 'ゐ' || c === 'ゑ' || c === 'を' || c === 'ん') return 'わ';
  for (let i = ROW_STARTS.length - 1; i >= 0; i--) {
    if (c >= ROW_STARTS[i]) return ROW_STARTS[i];
  }
  return 'あ';
}
