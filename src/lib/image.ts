/**
 * Kecilkan gambar story di browser sebelum diunggah (maks 1440×2560, WebP).
 * PNG hasil ekspor Canva sering 5–30 MB; hasilnya biasanya 200–600 KB tanpa beda kasat mata.
 */
export async function compressStory(file: File, maxW = 1440, maxH = 2560, quality = 0.88): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file; // GIF dibiarkan apa adanya
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob || (blob.size >= file.size && scale === 1)) return file;
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/** Judul awal dari nama file: "17_Rahul Paris_instagram.png" → "Rahul Paris" */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/\.(jpe?g|png)$/i, "")
    .replace(/_?\d{8}_\d{6}_\d{4}/g, "")
    .replace(/instagram.*$/i, "")
    .replace(/[_#]+/g, " ")
    .replace(/\(\d+\)/g, "")
    .replace(/^\s*\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}
