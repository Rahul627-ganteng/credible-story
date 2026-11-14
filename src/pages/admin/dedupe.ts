import { useEffect } from "react";
import { useToast } from "../../components/ui";
import { DUP_IDENTICAL, clusters, imageHash } from "../../lib/phash";
import { supabase } from "../../lib/supabase";

export interface DupRow {
  id: string;
  member_id: string | null;
  member_name: string | null;
  file_url: string;
  final_url: string | null;
  submission_mode: "file" | "link";
  image_hash: string | null;
  duplicate_of: string | null;
  dup_ignore: boolean;
  is_archive: boolean;
  is_published_to_showcase: boolean;
  published_at: string | null;
  created_at: string;
  period_month: string;
  special_id: string | null;
}

const COLS = "id,member_id,member_name,file_url,final_url,submission_mode,image_hash,duplicate_of,dup_ignore,is_archive,is_published_to_showcase,published_at,created_at,period_month,special_id";
export const displayUrl = (r: Pick<DupRow, "final_url" | "file_url">) => r.final_url || r.file_url;

export async function loadDupRows(): Promise<DupRow[]> {
  const { data, error } = await supabase.from("story_submissions").select(COLS).or("is_archive.eq.true,is_published_to_showcase.eq.true");
  if (error) throw error;
  return (data ?? []) as DupRow[];
}

/** Hitung sidik gambar untuk karya yang belum punya (di browser admin), simpan per 20 */
export async function backfillHashes(rows: DupRow[], onProgress?: (done: number, total: number) => void): Promise<number> {
  const todo = rows.filter((r) => !r.image_hash && (r.submission_mode === "file" || r.final_url));
  let done = 0, saved = 0;
  const buf: { id: string; h: string }[] = [];
  const flush = async () => {
    if (!buf.length) return;
    const chunk = buf.splice(0, buf.length);
    const { error } = await supabase.rpc("admin_set_hashes", { p: chunk });
    if (!error) saved += chunk.length;
  };
  const queue = [...todo];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        const h = await imageHash(displayUrl(r));
        r.image_hash = h;
        buf.push({ id: r.id, h });
        if (buf.length >= 20) await flush();
      } catch { /* gambar tidak terbaca — lewati */ }
      onProgress?.(++done, todo.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await flush();
  return saved;
}

/** Pilih satu yang dipertahankan dari kelompok identik */
export function pickKeeper<T extends DupRow>(items: T[]): T {
  const score = (r: DupRow) =>
    (r.is_archive ? 0 : 1000) + (r.member_id ? 100 : 0) + (r.member_name && r.member_name !== "Tim Credible Story" ? 50 : 0) + (r.final_url ? 10 : 0) + (r.special_id ? 5 : 0);
  return [...items].sort((a, b) => score(b) - score(a) || (a.published_at ?? a.created_at).localeCompare(b.published_at ?? b.created_at))[0];
}

/** Tandai duplikat otomatis: dari tiap kelompok identik, satu tetap tampil, sisanya disembunyikan dari galeri */
export async function autoResolve(rows: DupRow[]): Promise<number> {
  const pool = rows.filter((r) => !r.dup_ignore && r.image_hash);
  const patch: { id: string; of: string | null }[] = [];
  for (const c of clusters(pool, DUP_IDENTICAL)) {
    const keep = c.items.find((i) => !i.duplicate_of && c.items.some((x) => x.duplicate_of === i.id)) ?? pickKeeper(c.items);
    for (const it of c.items) {
      if (it.id === keep.id) { if (it.duplicate_of) patch.push({ id: it.id, of: null }); continue; }
      if (it.duplicate_of !== keep.id) patch.push({ id: it.id, of: keep.id });
    }
  }
  if (!patch.length) return 0;
  const { error } = await supabase.rpc("admin_mark_duplicates", { p: patch });
  if (error) throw error;
  return patch.filter((p) => p.of).length;
}

let ranThisSession = false;

/** Berjalan diam-diam sekali per sesi admin: lengkapi sidik gambar & sembunyikan story identik dari galeri */
export function useHashBackfill() {
  const toast = useToast();
  useEffect(() => {
    if (ranThisSession) return;
    ranThisSession = true;
    (async () => {
      try {
        const rows = await loadDupRows();
        const missing = rows.filter((r) => !r.image_hash && (r.submission_mode === "file" || r.final_url)).length;
        if (missing) await backfillHashes(rows);
        const hidden = await autoResolve(rows);
        if (hidden) toast(`${hidden} story identik/menumpuk disembunyikan dari galeri (cek di Arsip Karya › Duplikat)`, "info");
      } catch { ranThisSession = false; }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
