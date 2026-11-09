import type { MemberEmoji } from "./types";

/** Emoji yang dipakai sebagai penanda Special Edition di rekap — tidak boleh dipilih member */
export const RESERVED_EMOJI = ["🌟"];

/** Pilihan cepat emoji rekap (member tetap boleh mengetik emoji lain) */
export const EMOJI_CHOICES = [
  "🌙", "⭐", "✨", "🔥", "💫", "🌈", "☀️", "🌊", "🍃", "🌿", "🌱", "🌸", "🌺", "🌻", "🌷",
  "🍁", "🍂", "❄️", "💧", "🕌", "📿", "📖", "🕊️", "🎨", "🖌️", "✏️", "📸", "🎯", "🚀", "💎", "👑",
  "🦋", "🐝", "🦁", "🐯", "🦅", "🐬", "🍀", "🍉", "🍓", "🍊", "☕", "🧋", "🎧", "⚡", "💜", "💚",
  "💙", "🧡", "❤️", "🤍", "🖤", "🤎", "💛", "🩵",
];

/** Benar bila teks berisi tepat satu emoji (satu grafem bergambar, termasuk bendera & varian warna kulit) */
export function isSingleEmoji(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<unknown> } }).Segmenter;
  const graphemes = Seg ? Array.from(new Seg("id", { granularity: "grapheme" }).segment(t)).length : Array.from(t).length;
  return graphemes === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t);
}

/**
 * Emoji efektif tiap member untuk bulan `pm`: pilihan di bulan itu, atau pilihan terakhir
 * sebelum bulan itu (terbawa sampai diganti).
 */
export function emojiMapFor(rows: MemberEmoji[], pm: string): Map<string, { emoji: string; from: string }> {
  const best = new Map<string, MemberEmoji>();
  for (const r of rows) {
    if (r.period_month > pm) continue;
    const cur = best.get(r.member_id);
    if (!cur || r.period_month > cur.period_month) best.set(r.member_id, r);
  }
  return new Map([...best].map(([id, r]) => [id, { emoji: r.emoji, from: r.period_month }]));
}
