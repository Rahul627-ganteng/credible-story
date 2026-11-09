import { CheckCircle2, Download, EyeOff, FileArchive, ImagePlus, Send, Star, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Empty, Field, PageLoader, Spinner, useToast } from "../../components/ui";
import { previewUrl } from "../../lib/hooks";
import { compressStory } from "../../lib/image";
import { STAGE_LABEL, publishInstant, pubStage, storyLabel, toJakartaDate } from "../../lib/publish";
import { fmtDate, monthLabel, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod, Story } from "../../lib/types";
import { batchFileName, codeFromFileName, downloadBlob, makeZip } from "../../lib/zip";
import { useAdminData } from "./data";

interface FinalDraft { key: string; file: File; preview: string; storyId: string | null }

const extOf = (url: string) => (url.split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "png").toLowerCase().replace("jpeg", "jpg");

export default function Publish({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const { member: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);

  const acc = useMemo(() => (data?.stories ?? []).filter((s) => s.qc_status === "acc")
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || (a.member_name ?? "").localeCompare(b.member_name ?? "") || (a.story_target ?? 99) - (b.story_target ?? 99)), [data]);
  const needFinal = acc.filter((s) => pubStage(s) === "need_final");
  const ready = acc.filter((s) => pubStage(s) === "final_ready");
  const live = acc.filter((s) => ["published", "scheduled"].includes(pubStage(s)));
  const notAcc = (data?.stories ?? []).filter((s) => s.qc_status !== "acc").length;

  // ---------- 1. Unduh batch ----------
  const [onlyNew, setOnlyNew] = useState(true);
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null);
  const downloadBatch = async () => {
    const items = onlyNew ? needFinal : acc;
    if (!items.length) return toast("Tidak ada story ACC untuk diunduh", "info");
    setZipping({ done: 0, total: items.length });
    const entries: { name: string; data: Uint8Array | string }[] = [];
    const links: string[] = [];
    const daftar: string[] = ["Kode\tStory\tNama\tKategori\tJudul"];
    for (const s of items) {
      const label = storyLabel(s, true);
      daftar.push(`${s.id.slice(0, 8)}\t${label}\t${s.member_name}\t${s.category ?? "-"}\t${s.title ?? "-"}`);
      if (s.submission_mode === "link") {
        links.push(`${s.id.slice(0, 8)} | ${label} | ${s.member_name} | ${s.title ?? "-"}\n   ${s.file_url}`);
      } else {
        try {
          const res = await fetch(s.file_url);
          if (!res.ok) throw new Error(String(res.status));
          const buf = new Uint8Array(await res.arrayBuffer());
          entries.push({ name: `${s.category ?? "Lainnya"}/${batchFileName({ pm, label, name: s.member_name ?? "Tanpa-Nama", title: s.title, id: s.id, ext: extOf(s.file_url) })}`, data: buf });
        } catch {
          links.push(`${s.id.slice(0, 8)} | ${label} | ${s.member_name} | GAGAL DIUNDUH — buka manual:\n   ${s.file_url}`);
        }
      }
      setZipping((z) => (z ? { ...z, done: z.done + 1 } : z));
    }
    entries.push({ name: "DAFTAR.tsv", data: daftar.join("\n") });
    entries.push({ name: "CARA_PAKAI.txt", data: `Batch ACC Credible Story — ${monthLabel(pm)}\n\n1. Beri watermark di Photoshop.\n2. JANGAN hapus kode 8 karakter di akhir nama file (mis. _${items[0].id.slice(0, 8)}). Boleh menambah akhiran seperti _wm.\n3. Unggah semua hasilnya di Admin Center › Batch & Publikasi › langkah 2 — sistem mencocokkan otomatis lewat kode tersebut.\n` });
    if (links.length) entries.push({ name: "LINK_EKSTERNAL.txt", data: `Story yang disetor sebagai link (unduh manual):\n\n${links.join("\n\n")}\n` });
    downloadBlob(makeZip(entries), `CredibleStory_Batch-ACC_${pm}${onlyNew ? "" : "_semua"}.zip`);
    setZipping(null);
    toast(`${entries.length - (links.length ? 3 : 2)} desain diunduh${links.length ? ` · ${links.length} perlu diunduh manual (lihat LINK_EKSTERNAL.txt)` : ""}`);
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
        const path = `${me.id}/final/${pm}/${d.storyId}-${Date.now()}.${up.name.split(".").pop()}`;
        const r = await supabase.storage.from("stories").upload(path, up, { contentType: up.type, cacheControl: "31536000" });
        if (r.error) throw r.error;
        const url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
        const { error } = await supabase.from("story_submissions").update({ final_url: url }).eq("id", d.storyId!);
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
          ["Belum ACC / revisi", notAcc, "di tab QC"],
          ["Menunggu watermark", needFinal.length, "langkah 1–2"],
          ["Final siap terbit", ready.length, "langkah 3"],
          ["Sudah di galeri", live.length, monthLabel(pm)],
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
        <StepHead n={1} title="Unduh batch desain ACC" desc={`Semua story ACC ${monthLabel(pm)} dalam satu .zip, dipisah per folder Ikhwan/Akhwat. Nama file berisi kode 8 karakter untuk pencocokan otomatis.`} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={downloadBatch} disabled={!!zipping || !acc.length}>
            {zipping ? <><Spinner /> Menyiapkan {zipping.done}/{zipping.total}…</> : <><Download className="h-4 w-4" /> Unduh batch ({onlyNew ? needFinal.length : acc.length} story)</>}
          </button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Hanya yang belum diberi watermark</label>
        </div>
        {notAcc > 0 && <p className="mt-3 text-xs text-amber-800">⚠️ Masih ada {notAcc} setoran belum ACC bulan ini. Selesaikan QC dulu bila ingin batch lengkap.</p>}
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
            <summary className="cursor-pointer font-semibold text-ink">Belum ada versi final ({needFinal.length})</summary>
            <ul className="mt-2 grid gap-1 text-xs text-ink-muted sm:grid-cols-2">
              {needFinal.map((s) => <li key={s.id}><span className="font-mono">{s.id.slice(0, 8)}</span> · {s.member_name} · {storyLabel(s, true)} · {s.title}</li>)}
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

      {/* Status lengkap */}
      <section className="card p-5">
        <p className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><FileArchive className="h-4 w-4 text-crimson-600" /> Status publikasi {monthLabel(pm)}</p>
        {acc.length === 0 ? <Empty title="Belum ada story ACC bulan ini" /> : (
          <div className="divide-y divide-slate-100">
            {acc.map((s) => {
              const st = STAGE_LABEL[pubStage(s)];
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <Thumb s={s} final />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.member_name} · {storyLabel(s)}</p>
                    <p className="truncate text-xs text-ink-muted">{s.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={st.cls}>{st.text}{s.published_at && ["published", "scheduled"].includes(pubStage(s)) ? ` · ${fmtDate(toJakartaDate(s.published_at))}` : ""}</span>
                      <span className="font-mono text-[10px] text-ink-muted">{s.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  {["published", "scheduled"].includes(pubStage(s)) && (
                    <button className="btn-ghost btn-sm" onClick={() => unpublish(s)} title="Turunkan dari galeri"><EyeOff className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              );
            })}
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
