import { supabase } from "./supabase";

/**
 * File asli (kualitas penuh, format apa adanya) disimpan di bucket privat "originals".
 * Galeri & QC tetap memakai versi WebP ringan; unduhan admin memakai file asli ini.
 */
export const ORIGINALS = "originals";
export const ORIGINAL_MAX_MB = 40;

export interface OriginalInfo { original_path: string; original_name: string; original_size: number }

/** Unggah file asli ke folder milik member. Gagal → null (setoran tetap jalan dengan versi ringan). */
export async function uploadOriginal(file: File, ownerId: string, folder: string, base: string): Promise<OriginalInfo | null> {
  if (file.size > ORIGINAL_MAX_MB * 1024 * 1024) return null;
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace("jpeg", "jpg");
  const path = `${ownerId}/${folder}/${base}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ORIGINALS).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return null;
  return { original_path: path, original_name: file.name.slice(0, 200), original_size: file.size };
}

export async function removeOriginals(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(ORIGINALS).remove(list);
}

const extOfUrl = (u: string) => (u.split("?")[0].split(".").pop() || "png").toLowerCase();

/** Ubah gambar (mis. WebP lama) menjadi PNG tanpa kompresi tambahan */
async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  return await new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Gagal mengubah ke PNG"))), "image/png"));
}

/**
 * Ambil file terbaik untuk diunduh admin:
 * 1) file asli dari member (kualitas penuh), atau
 * 2) bila setoran lama hanya punya WebP → diubah ke PNG (tanpa kompresi tambahan).
 */
export async function fetchBestFile(s: { file_url: string; original_path?: string | null }): Promise<{ blob: Blob; ext: string; original: boolean }> {
  if (s.original_path) {
    const { data, error } = await supabase.storage.from(ORIGINALS).download(s.original_path);
    if (!error && data) return { blob: data, ext: extOfUrl(s.original_path), original: true };
  }
  const res = await fetch(s.file_url);
  if (!res.ok) throw new Error(`Gagal mengunduh (${res.status})`);
  const blob = await res.blob();
  const ext = extOfUrl(s.file_url);
  if (ext === "webp" || blob.type === "image/webp") return { blob: await toPng(blob), ext: "png", original: false };
  return { blob, ext: ext === "jpeg" ? "jpg" : ext, original: false };
}
