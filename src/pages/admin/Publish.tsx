import { CheckCircle2, Circle, Download, ExternalLink, EyeOff, ImagePlus, RotateCcw, Send, Star, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Empty, Field, PageLoader, Spinner, useToast } from "../../components/ui";
import { must, previewUrl, useLive } from "../../lib/hooks";
import { compressStory } from "../../lib/image";
import { STAGE_LABEL, needsWatermark, publishInstant, pubStage, storyLabel, toJakartaDate } from "../../lib/publish";
import { imageHash } from "../../lib/phash";
import { ORIGINALS, fetchBestFile } from "../../lib/originals";
import { fmtDate, fmtDateTime, monthLabel, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod, Story } from "../../lib/types";
import { batchFileName, codeFromFileName, downloadBlob, makeZip } from "../../lib/zip";
import { useAdminData } from "./data";

interface FinalDraft { key: string; file: File; preview: string; storyId: string | null }

type ListFilter = "all" | "nowm" | "notdl" | "dl" | "wm" | "ready" | "live";
const LIST_FILTERS: [ListFilter, string][] = [
  ["nowm", "Belum watermark"], ["notdl", "Belum diunduh"], ["dl", "Sudah diunduh"], ["wm", "Sudah watermark"],
  ["ready", "Final siap terbit"], ["live", "Terbit"], ["all", "Semua"],
]

const extOf = (url: string) => (url.split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "png").toLowerCase().replace("jpeg", "jpg");

export default function Publish({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const { member: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);

  const acc = useMemo(() => (data?.stories ?? []).filter((s) => s.qc_status === "acc")
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || (a.member_name ?? "").localeCompare(b.member_name ?? "") || (a.story_target ?? 99) - (b.story_target ?? 99)), [data]);
  const needFinal = acc.filter((s) => ["need_final", "watermarked"].includes(pubStage(s)));
  const notWm = acc.filter(needsWatermark);
  const wmNoFinal = acc.filter((s) => pubStage(s) === "watermarked");
  const ready = acc.filter((s) => pubStage(s) === "final_ready");
  const live = acc.filter((s) => ["published", "scheduled"].includes(pubStage(s)));
  const notAcc = (data?.stories ?? []).filter((s) => s.qc_status !== "acc").length;
  const notDownloaded = notWm.filter((s) => !s.downloaded_at);

  // ---------- 1. Unduh (batch / satuan) ----------
  type Scope = "fresh" | "nowm" | "all";
  const [scope, setScope] = useState<Scope>("fresh");
  const scopeItems = scope === "fresh" ? notDownloaded : scope === "nowm" ? notWm : acc;
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const fileNameOf = (s: Story, ext = extOf(s.file_url)) => batchFileName({ pm, label: storyLabel(s, true), name: s.member_name ?? "Tanpa-Nama", title: s.title, id: s.id, ext });
  const markDownloaded = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from("story_submissions").update({ downloaded_at: new Date().toISOString() }).in("id", ids);
  };
  const downloadOne = async (s: Story) => {
    setRowBusy(s.id);
    try {
      if (s.submission_mode === "link") {
        window.open(s.file_url, "_blank");
      } else {
        const f = await fetchBestFile(s);
        downloadBlob(f.blob, fileNameOf(s, f.ext));
        if (!f.original) toast("Setoran ini diunggah sebelum fitur file asli — yang tersedia versi ringan, diunduh sebagai PNG", "info");
      }
      await markDownloaded([s.id]);
      toast(`${s.member_name} · ${storyLabel(s)} diunduh — tidak akan ikut batch berikutnya`);
      reload();
    } catch (e) {
      toast(errMsg(e), "err");
      window.open(s.file_url, "_blank");
    } finally {
      setRowBusy(null);
    }
  };
  const setWatermark = async (s: Story, on: boolean) => {
    setRowBusy(s.id);
    const { error } = await supabase.from("story_submissions").update({ watermarked_at: on ? new Date().toISOString() : null }).eq("id", s.id);
    setRowBusy(null);
    if (error) return toast(errMsg(error), "err");
    reload();
  };
  const resetDownload = async (s: Story) => {
    const { error } = await supabase.from("story_submissions").update({ downloaded_at: null }).eq("id", s.id);
    if (error) toast(errMsg(error), "err"); else { toast("Masuk antrean batch lagi"); reload(); }
  };
  const downloadBatch = async () => {
    const items = scopeItems;
    if (!items.length) return toast("Tidak ada story untuk diunduh di pilihan ini", "info");
    setZipping({ done: 0, total: items.length });
    const entries: { name: string; data: Uint8Array | string }[] = [];
    const links: string[] = [];
    const daftar: string[] = ["Kode\tStory\tNama\tKategori\tJudul\tKualitas"];
    let lite = 0;
    for (const s of items) {
      const label = storyLabel(s, true);
      if (s.submission_mode === "link") {
        daftar.push(`${s.id.slice(0, 8)}\t${label}\t${s.member_name}\t${s.category ?? "-"}\t${s.title ?? "-"}\tlink`);
        links.push(`${s.id.slice(0, 8)} | ${label} | ${s.member_name} | ${s.title ?? "-"}\n   ${s.file_url}`);
      } else {
        try {
          const f = await fetchBestFile(s);
          if (!f.original) lite++;
          daftar.push(`${s.id.slice(0, 8)}\t${label}\t${s.member_name}\t${s.category ?? "-"}\t${s.title ?? "-"}\t${f.original ? "file asli" : "versi ringan (PNG)"}`);
          entries.push({ name: `${s.category ?? "Lainnya"}/${fileNameOf(s, f.ext)}`, data: new Uint8Array(await f.blob.arrayBuffer()) });
        } catch {
          links.push(`${s.id.slice(0, 8)} | ${label} | ${s.member_name} | GAGAL DIUNDUH — buka manual:\n   ${s.file_url}`);
        }
      }
      setZipping((z) => (z ? { ...z, done: z.done + 1 } : z));
    }
    entries.push({ name: "DAFTAR.tsv", data: daftar.join("\n") });
    entries.push({ name: "CARA_PAKAI.txt", data: `Batch ACC Credible Story — ${monthLabel(pm)}\n\n1. Beri watermark di Photoshop.\n2. JANGAN hapus kode 8 karakter di akhir nama file (mis. _${items[0].id.slice(0, 8)}). Boleh menambah akhiran seperti _wm.\n3. Unggah semua hasilnya di Admin Center › Batch & Publikasi › langkah 2 — sistem mencocokkan otomatis lewat kode tersebut.\n` });
    if (links.length) entries.push({ name: "LINK_EKSTERNAL.txt", data: `Story yang disetor sebagai link (unduh manual):\n\n${links.join("\n\n")}\n` });
    downloadBlob(makeZip(entries), `CredibleStory_Batch-ACC_${pm}${scope === "all" ? "_semua" : scope === "nowm" ? "_belum-watermark" : ""}_${todayJakarta()}.zip`);
    await markDownloaded(items.map((s) => s.id));
    setZipping(null);
    toast(`${entries.length - (links.length ? 3 : 2)} desain diunduh${lite ? ` (${lite} setoran lama hanya tersedia versi ringan)` : " dalam kualitas asli"}${links.length ? ` · ${links.length} perlu diunduh manual (lihat LINK_EKSTERNAL.txt)` : ""}`);
    reload();
  };

  // ---------- Penyimpanan file asli ----------
  const { data: origRows, reload: reloadOrig } = useLive(async () =>
    must(await supabase.from("story_submissions").select("id,original_path,original_size,is_published_to_showcase").not("original_path", "is", null)) as Pick<Story, "id" | "original_path" | "original_size" | "is_published_to_showcase">[],
  [], ["story_submissions"]);
  const origMB = (origRows ?? []).reduce((t, r) => t + (r.original_size ?? 0), 0) / 1048576;
  const origPublished = (origRows ?? []).filter((r) => r.is_published_to_showcase);
  const [cleaning, setCleaning] = useState(false);
  const cleanPublished = async () => {
    if (!origPublished.length) return;
    if (!confirm(`Hapus ${origPublished.length} file asli dari story yang sudah terbit di galeri? Versi galeri & data setoran tetap ada. Pastikan file aslinya sudah kamu simpan.`)) return;
    setCleaning(true);
    const paths = origPublished.map((r) => r.original_path!).filter(Boolean);
    const { error } = await supabase.storage.from(ORIGINALS).remove(paths);
    if (!error) await supabase.from("story_submissions").update({ original_path: null, original_name: null, original_size: null }).in("id", origPublished.map((r) => r.id));
    setCleaning(false);
    if (error) return toast(errMsg(error), "err");
    toast(`${paths.length} file asli dihapus — ruang penyimpanan lega lagi`);
    reloadOrig(); reload();
  };

  // ---------- 2. Unggah hasil watermark ----------
  const [drafts, setDrafts] = useState<FinalDraft[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const addFinals = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.type.startsWith("image/")).map((f) => {
      const code = codeFromFileName(f.name);
      const match = code ? acc.find((s) => s.id.startsWith(code)) : undefined;
      return { key: `${f.name}-${f.size}`, file: f, preview: URL.createObjectURL(f), storyId: match?.id ?? null };
    });
    setDrafts((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.key === n.key))]);
  };
  const saveFinals = async () => {
    const todo = drafts.filter((d) => d.storyId);
    if (!todo.length || !me) return toast("Belum ada file yang dicocokkan ke story", "err");
    setUploading({ done: 0, total: todo.length });
    const failed: FinalDraft[] = drafts.filter((d) => !d.storyId);
    let ok = 0;
    for (const d of todo) {
      try {
        const up = await compressStory(d.file, 1440, 2560, 0.92);
        const hash = await imageHash(up).catch(() => null);
        const path = `${me.id}/final/${pm}/${d.storyId}-${Date.now()}.${up.name.split(".").pop()}`;
        const r = await supabase.storage.from("stories").upload(path, up, { contentType: up.type, cacheControl: "31536000" });
        if (r.error) throw r.error;
        const url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
        const { error } = await supabase.from("story_submissions").update({ final_url: url, ...(hash ? { image_hash: hash } : {}) }).eq("id", d.storyId!);
        if (error) throw error;
        ok++;
      } catch (e) {
        failed.push(d);
        toast(`${d.file.name}: ${errMsg(e)}`, "err");
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    setDrafts(failed);
    toast(`${ok} versi final tersimpan — siap diterbitkan`);
    reload();
  };

  // ---------- 3. Terbitkan ----------
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [listFilter, setListFilter] = useState<ListFilter>("nowm");
  const [pubDate, setPubDate] = useState(todayJakarta());
  const [waLink, setWaLink] = useState("");
  const [publishing, setPublishing] = useState(false);
  const chosen = ready.filter((s) => pick[s.id] !== false);
  const publish = async () => {
    if (!chosen.length) return;
    if (waLink && !/^https:\/\//.test(waLink)) return toast("Link Channel WA harus diawali https://", "err");
    setPublishing(true);
    const when = publishInstant(pubDate);
    const { error } = await supabase.from("story_submissions").update({
      is_published_to_showcase: true, published_at: when, ...(waLink.trim() ? { wa_channel_link: waLink.trim() } : {}),
    }).in("id", chosen.map((s) => s.id));
    setPublishing(false);
    if (error) return toast(errMsg(error), "err");
    toast(pubDate > todayJakarta() ? `${chosen.length} story terjadwal tampil ${fmtDate(pubDate, true)} 07.00 WIB` : `${chosen.length} story terbit di galeri${pubDate === todayJakarta() ? " & sorotan Terbit Hari Ini" : ""}`);
    setPick({});
    reload();
  };
  const unpublish = async (s: Story) => {
    const { error } = await supabase.from("story_submissions").update({ is_published_to_showcase: false }).eq("id", s.id);
    if (error) toast(errMsg(error), "err"); else { toast("Diturunkan dari galeri"); reload(); }
  };

  if (loading || !data) return <PageLoader />;

  const matchFilter = (x: Story, k: ListFilter) => {
    const stg = pubStage(x);
    switch (k) {
      case "nowm": return needsWatermark(x);
      case "notdl": return needsWatermark(x) && !x.downloaded_at;
      case "dl": return !!x.downloaded_at && !x.final_url && !["published", "scheduled"].includes(stg);
      case "wm": return stg === "watermarked";
      case "ready": return stg === "final_ready";
      case "live": return stg === "published" || stg === "scheduled";
      default: return true;
    }
  };

  const Thumb = ({ s, final = false }: { s: Story; final?: boolean }) => {
    const src = previewUrl(final && s.final_url ? s.final_url : s.file_url, final && s.final_url ? "file" : s.submission_mode);
    return (
      <div className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
        {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {s.special_id && <Star className="absolute right-0.5 top-0.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Belum watermark", notWm.length, `${notDownloaded.length} belum diunduh`],
          ["Sudah watermark", wmNoFinal.length, "final belum diunggah"],
          ["Final siap terbit", ready.length, "langkah 3"],
          ["Sudah di galeri", live.length, notAcc ? `${notAcc} setoran belum ACC` : monthLabel(pm)],
        ].map(([l, v, sub]) => (
          <div key={String(l)} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l}</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-ink">{v}</p>
            <p className="text-xs text-ink-muted">{sub}</p>
          </div>
        ))}
      </div>

      {/* Langkah 1 */}
      <section className="card p-5">
        <StepHead n={1} title="Unduh desain ACC" desc="Unduh satuan dari daftar di bawah, atau sekaligus satu .zip — dalam format & kualitas asli dari member (PNG/JPG), bukan WebP. Story yang sudah diunduh tidak ikut batch berikutnya. Nama file berisi kode 8 karakter untuk pencocokan otomatis." />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Isi batch">
            <option value="fresh">Belum pernah diunduh ({notDownloaded.length})</option>
            <option value="nowm">Semua yang belum watermark ({notWm.length})</option>
            <option value="all">Semua story ACC ({acc.length})</option>
          </select>
          <button className="btn-primary" onClick={downloadBatch} disabled={!!zipping || !scopeItems.length}>
            {zipping ? <><Spinner /> Menyiapkan {zipping.done}/{zipping.total}…</> : <><Download className="h-4 w-4" /> Unduh batch ({scopeItems.length})</>}
          </button>
        </div>
        {notAcc > 0 && <p className="mt-3 text-xs text-amber-800">⚠️ Masih ada {notAcc} setoran belum ACC bulan ini. Selesaikan QC dulu bila ingin batch lengkap.</p>}
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${origMB > 700 ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-ink-muted"}`}>
          <span>
            Unduhan memakai <b className="text-ink">file asli kualitas penuh</b> dari member. Tersimpan: {(origRows ?? []).length} file · {origMB < 1024 ? `${origMB.toFixed(0)} MB` : `${(origMB / 1024).toFixed(2)} GB`} dari kuota penyimpanan gratis 1 GB.
            {origMB > 700 && " Hampir penuh — kosongkan file asli story yang sudah terbit."}
          </span>
          {origPublished.length > 0 && (
            <button className="btn-ghost btn-sm" onClick={cleanPublished} disabled={cleaning}>{cleaning ? <Spinner /> : null} Kosongkan {origPublished.length} file asli yang sudah terbit</button>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Daftar story ACC · {monthLabel(pm)}</p>
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
              {LIST_FILTERS.map(([k, l]) => {
                const n = acc.filter((x) => matchFilter(x, k)).length;
                return (
                  <button key={k} onClick={() => setListFilter(k)} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${listFilter === k ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-ink-body"}`}>
                    {l} <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {acc.length === 0 ? <Empty title="Belum ada story ACC bulan ini" /> : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {acc.filter((x) => matchFilter(x, listFilter)).map((s) => {
                const st = STAGE_LABEL[pubStage(s)];
                const wm = !!(s.watermarked_at || s.final_url);
                const isLive = ["published", "scheduled"].includes(pubStage(s));
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <Thumb s={s} final />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{s.member_name} · {storyLabel(s)}</p>
                      <p className="truncate text-xs text-ink-muted">{s.title || "Tanpa judul"} · <span className="font-mono">{s.id.slice(0, 8)}</span></p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={st.cls}>{st.text}{s.published_at && isLive ? ` · ${fmtDate(toJakartaDate(s.published_at))}` : ""}</span>
                        {s.submission_mode === "file" && (s.original_path
                          ? <span className="badge-green" title={s.original_name ?? undefined}>File asli{s.original_size ? ` · ${(s.original_size / 1048576).toFixed(1)} MB` : ""}</span>
                          : <span className="badge-slate" title="Diunggah sebelum fitur file asli; diunduh sebagai PNG">Versi ringan</span>)}
                        {s.downloaded_at && !s.final_url && (
                          <span className="badge-slate" title={`Diunduh ${fmtDateTime(s.downloaded_at)}`}>
                            <Download className="h-3 w-3" /> Diunduh {fmtDate(toJakartaDate(s.downloaded_at))}
                            <button className="ml-0.5 rounded hover:text-ink" onClick={() => resetDownload(s)} title="Masukkan lagi ke antrean batch"><RotateCcw className="h-3 w-3" /></button>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                      <button className="btn-ghost btn-sm" onClick={() => downloadOne(s)} disabled={rowBusy === s.id} title={s.submission_mode === "link" ? "Buka link karya" : s.original_path ? "Unduh file asli kualitas penuh" : "Unduh (versi ringan, sebagai PNG)"}>
                        {rowBusy === s.id ? <Spinner /> : s.submission_mode === "link" ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} Unduh
                      </button>
                      <button onClick={() => setWatermark(s, !wm)} disabled={rowBusy === s.id || !!s.final_url} aria-pressed={wm}
                        title={s.final_url ? "Versi final sudah diunggah" : wm ? "Klik bila ternyata belum diberi watermark" : "Tandai sudah diberi watermark"}
                        className={`btn-sm ${wm ? "btn bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "btn-ghost"}`}>
                        {wm ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} {wm ? "Sudah watermark" : "Belum watermark"}
                      </button>
                      {isLive && <button className="btn-ghost btn-sm" onClick={() => unpublish(s)} title="Turunkan dari galeri"><EyeOff className="h-3.5 w-3.5" /></button>}
                    </div>
                  </div>
                );
              })}
              {acc.filter((x) => matchFilter(x, listFilter)).length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-muted">Tidak ada story di filter ini.</p>}
            </div>
          )}
        </div>
      </section>

      {/* Langkah 2 */}
      <section className="card p-5">
        <StepHead n={2} title="Unggah hasil watermark" desc="Pilih semua file hasil Photoshop sekaligus. File dicocokkan lewat kode di nama file; yang tidak cocok bisa dipilih manual." />
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-ink-muted transition hover:border-crimson-500 hover:text-crimson-700"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFinals(e.dataTransfer.files); }}>
          <ImagePlus className="h-7 w-7" />
          <span><b className="text-ink">Klik atau seret</b> file hasil watermark ke sini</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { addFinals(e.target.files); e.target.value = ""; }} />
        </label>
        {drafts.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {drafts.map((d, i) => {
                const s = acc.find((x) => x.id === d.storyId);
                return (
                  <div key={d.key} className={`flex items-center gap-3 rounded-xl border p-2 ${s ? "border-emerald-200 bg-emerald-50/40" : "border-amber-300 bg-amber-50"}`}>
                    <img src={d.preview} alt="" className="h-20 w-[45px] shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] text-ink-muted">{d.file.name}</p>
                      <select className="input mt-1 py-1.5 text-sm" value={d.storyId ?? ""} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, storyId: e.target.value || null } : x)))}>
                        <option value="">— pilih story —</option>
                        {acc.map((x) => <option key={x.id} value={x.id}>{x.member_name} · {storyLabel(x, true)} · {x.title}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDrafts([])} disabled={!!uploading}>Batal</button>
              <button className="btn-primary" onClick={saveFinals} disabled={!!uploading}>
                {uploading ? <><Spinner /> Mengunggah {uploading.done}/{uploading.total}…</> : <><Upload className="h-4 w-4" /> Simpan {drafts.filter((d) => d.storyId).length} versi final</>}
              </button>
            </div>
          </div>
        )}
        {needFinal.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-ink">Belum ada versi final ({needFinal.length}{wmNoFinal.length ? ` · ${wmNoFinal.length} sudah watermark` : ""})</summary>
            <ul className="mt-2 grid gap-1 text-xs text-ink-muted sm:grid-cols-2">
              {needFinal.map((s) => <li key={s.id}><span className="font-mono">{s.id.slice(0, 8)}</span> · {s.member_name} · {storyLabel(s, true)} · {s.title}{s.watermarked_at ? " · ✓ watermark" : ""}</li>)}
            </ul>
          </details>
        )}
      </section>

      {/* Langkah 3 */}
      <section className="card p-5">
        <StepHead n={3} title="Terbitkan ke Galeri Kurasi" desc="Pilih tanggal saat story diunggah ke Channel WA. Tanggal hari ini langsung masuk sorotan “Terbit Hari Ini”; tanggal mendatang otomatis tampil 07.00 WIB." />
        {ready.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Belum ada versi final yang siap diterbitkan.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {ready.map((s) => {
                const on = pick[s.id] !== false;
                return (
                  <button key={s.id} onClick={() => setPick({ ...pick, [s.id]: !on })} className={`w-[92px] shrink-0 text-left transition ${on ? "" : "opacity-40"}`}>
                    <div className={`relative overflow-hidden rounded-xl ring-2 ${on ? "ring-crimson-500" : "ring-transparent"}`} style={{ aspectRatio: "9/16" }}>
                      <img src={s.final_url!} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {on && <CheckCircle2 className="absolute right-1 top-1 h-5 w-5 fill-white text-crimson-600" />}
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-ink">{s.member_name}</p>
                    <p className="truncate text-[10px] text-ink-muted">{storyLabel(s, true)} · {s.title}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <Field label="Tanggal posting"><input type="date" className="input font-mono" value={pubDate} onChange={(e) => setPubDate(e.target.value || todayJakarta())} /></Field>
              <Field label="Link postingan Channel WA (opsional)"><input className="input" value={waLink} onChange={(e) => setWaLink(e.target.value)} placeholder="https://whatsapp.com/channel/…" /></Field>
              <button className="btn-primary" onClick={publish} disabled={publishing || !chosen.length}>{publishing ? <Spinner /> : <Send className="h-4 w-4" />} Terbitkan {chosen.length}</button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

function StepHead({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-crimson-grad font-display text-sm font-bold text-white">{n}</span>
      <div>
        <p className="font-display text-lg font-bold text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{desc}</p>
      </div>
    </div>
  );
}
