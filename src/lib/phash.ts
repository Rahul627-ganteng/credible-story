/**
 * Sidik gambar perseptual (dHash 256-bit) untuk mendeteksi story yang identik / terunggah dua kali,
 * walau beda format, ukuran, kompresi, atau diberi watermark kecil.
 * Kalibrasi pada 143 arsip: desain berbeda (termasuk template sama) berjarak ≥ 78 bit;
 * gambar sama yang di-resize/di-watermark berjarak ≤ 8 bit.
 */
export const DUP_IDENTICAL = 24; // ≤ ini: dianggap story yang sama → disembunyikan otomatis
export const DUP_SIMILAR = 45; // ≤ ini: mirip, ditampilkan untuk diperiksa admin

const W = 17, H = 16, S = 8;

async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  // Ambil sebagai blob dulu supaya kanvas tidak "tercemar" oleh cache gambar tanpa header CORS
  const blob = typeof src === "string" ? await fetch(src, { mode: "cors", cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Gambar tidak bisa diunduh (${r.status})`);
    return r.blob();
  }) : src;
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Hash 64 karakter hex dari URL gambar atau File/Blob */
export async function imageHash(src: string | Blob): Promise<string> {
  const img = await loadImage(src);
  const cw = W * S, ch = H * S;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  const px = ctx.getImageData(0, 0, cw, ch).data;
  const g = new Float64Array(W * H);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y * cw + x) * 4;
    g[Math.floor(y / S) * W + Math.floor(x / S)] += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  let hex = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < 16; x += 4) {
      let n = 0;
      for (let k = 0; k < 4; k++) n = (n << 1) | (g[y * W + x + k] < g[y * W + x + k + 1] ? 1 : 0);
      hex += n.toString(16);
    }
  }
  return hex;
}

const POP = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 999;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

/** Cari item dengan hash terdekat (≤ batas) */
export function findDuplicate<T extends { id: string; image_hash: string | null }>(hash: string, items: T[], limit = DUP_IDENTICAL, exceptId?: string) {
  let best: { item: T; dist: number } | null = null;
  for (const it of items) {
    if (!it.image_hash || it.id === exceptId) continue;
    const d = hamming(hash, it.image_hash);
    if (d <= limit && (!best || d < best.dist)) best = { item: it, dist: d };
  }
  return best;
}

/** Kelompokkan item yang saling identik/mirip (union-find) */
export function clusters<T extends { id: string; image_hash: string | null }>(items: T[], limit = DUP_IDENTICAL): { items: T[]; maxDist: number }[] {
  const list = items.filter((i) => i.image_hash);
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (hamming(list[i].image_hash!, list[j].image_hash!) <= limit) {
      const a = find(i), b = find(j);
      if (a !== b) parent[b] = a;
    }
  }
  const groups = new Map<number, T[]>();
  list.forEach((it, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), it]); });
  return [...groups.values()].filter((g) => g.length > 1).map((g) => {
    let maxDist = 0;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) maxDist = Math.max(maxDist, hamming(g[i].image_hash!, g[j].image_hash!));
    return { items: g, maxDist };
  });
}

/** Saring daftar galeri: dari item yang identik, tampilkan satu saja (urutan awal dipertahankan) */
export function dedupeByHash<T extends { image_hash: string | null }>(items: T[], limit = DUP_IDENTICAL): T[] {
  const kept: T[] = [];
  const hashes: string[] = [];
  for (const it of items) {
    if (it.image_hash && hashes.some((h) => hamming(h, it.image_hash!) <= limit)) continue;
    if (it.image_hash) hashes.push(it.image_hash);
    kept.push(it);
  }
  return kept;
}
