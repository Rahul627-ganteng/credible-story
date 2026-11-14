import { Copy as CopyIcon, Eye, EyeOff, ImagePlus, Layers, Pencil, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Empty, Field, Modal, PageLoader, Spinner, Stat, useToast } from "../../components/ui";
import { must, previewUrl, useLive } from "../../lib/hooks";
import { compressStory } from "../../lib/image";
import { DUP_IDENTICAL, DUP_SIMILAR, clusters, findDuplicate, hamming, imageHash } from "../../lib/phash";
import { emojiFor, fmtDate, monthLabel, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import { DESIGN_APPS, type ArchiveItem, type Category, type Member } from "../../lib/types";
import { autoResolve, backfillHashes, displayUrl, loadDupRows, pickKeeper, type DupRow } from "./dedupe";

type MemberLite = Pick<Member, "id" | "name" | "category" | "is_active" | "role">;
const TEAM = "Tim Credible Story";
const localDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const isoDate = (iso: string | null) => (iso ? localDate(new Date(iso).getTime()) : "");
const pubInstant = (date: string) => new Date(`${date}T${date === todayJakarta() ? new Date().toTimeString().slice(0, 8) : "19:00:00"}+07:00`).toISOString();

/** Pilihan kreator: akun member, atau nama bebas (alumni / tamu) */
function CreatorPicker({ members, value, onChange }: {
  members: MemberLite[];
  value: { memberId: string | null; name: string; category: Category | "" };
  onChange: (v: { memberId: string | null; name: string; category: Category | "" }) => void;
}) {
  const mode = value.memberId ? `m:${value.memberId}` : "custom";
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <select className="input" value={mode} onChange={(e) => {
        const v = e.target.value;
        if (v === "custom") onChange({ memberId: null, name: value.memberId ? TEAM : value.name, category: value.category });
        else { const m = members.find((x) => `m:${x.id}` === v); onChange({ memberId: m!.id, name: m!.name, category: (m!.category ?? "") as Category | "" }); }
      }}>
        <option value="custom">— Nama bebas / Tim Credible Story —</option>
        {(["Ikhwan", "Akhwat"] as const).map((c) => (
          <optgroup key={c} label={c}>
            {members.filter((m) => m.category === c).map((m) => <option key={m.id} value={`m:${m.id}`}>{m.name}{m.is_active ? "" : " (nonaktif)"}</option>)}
          </optgroup>
        ))}
      </select>
      {!value.memberId && (
        <select className="input w-auto" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as Category | "" })} aria-label="Kategori">
          <option value="">Kategori –</option><option>Ikhwan</option><option>Akhwat</option>
        </select>
      )}
      {!value.memberId && (
        <input className="input sm:col-span-2" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Nama kreator (mis. alumni / kontributor tamu)" />
      )}
    </div>
  );
}

interface Draft {
  key: string; file: File; preview: string; date: string;
  hash?: string | null;
  /** Karya yang identik dengan file ini (sudah ada di arsip/galeri, atau file lain di antrean) */
  dup?: { label: string; dist: number } | null;
  skip?: boolean;
}

export default function Archive() {
  const { member: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useLive(async () => {
    const [a, m] = await Promise.all([
      supabase.from("story_submissions").select("id,member_id,member_name,category,period_month,title,submission_mode,file_url,final_url,design_app,wa_channel_link,is_published_to_showcase,published_at,is_archive,created_at,image_hash,duplicate_of,dup_ignore").eq("is_archive", true).order("published_at", { ascending: false, nullsFirst: true }),
      supabase.from("members").select("id,name,category,is_active,role").eq("role", "member").order("name"),
    ]);
    return { items: must(a) as ArchiveItem[], members: must(m) as MemberLite[], all: await loadDupRows() };
  }, [], ["story_submissions"]);

  // ---------- unggah massal ----------
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [batch, setBatch] = useState({ memberId: null as string | null, name: TEAM, category: "" as Category | "", app: "", wa: "", publish: true });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const labelOf = (r: Pick<DupRow, "member_name" | "published_at" | "is_archive">) =>
    `${r.member_name || TEAM}${r.published_at ? ` · ${fmtDate(isoDate(r.published_at))}` : ""}${r.is_archive ? "" : " · setoran"}`;
  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const fresh: Draft[] = Array.from(list).filter((f) => /^image\//.test(f.type)).map((f) => ({
      key: `${f.name}-${f.size}-${f.lastModified}`, file: f, preview: URL.createObjectURL(f),
      date: localDate(f.lastModified || Date.now()), hash: undefined,
    }));
    const next = fresh.filter((n) => !drafts.some((c) => c.key === n.key));
    setDrafts((cur) => [...cur, ...next].slice(0, 60));
    // Sidik gambar: tandai file yang sudah pernah terbit / dobel di antrean
    const known: DupRow[] = (data?.all ?? []).filter((r: DupRow) => r.image_hash && !r.duplicate_of);
    const seen: { hash: string; key: string }[] = drafts.filter((d) => d.hash).map((d) => ({ hash: d.hash!, key: d.key }));
    for (const d of next) {
      let hash: string | null = null;
      try { hash = await imageHash(d.file); } catch { /* lewati */ }
      let dup: Draft["dup"] = null;
      if (hash) {
        const hit = findDuplicate(hash, known, DUP_IDENTICAL);
        if (hit) dup = { label: `Sudah ada: ${labelOf(hit.item)}`, dist: hit.dist };
        else {
          const twin = seen.find((x) => hamming(hash!, x.hash) <= DUP_IDENTICAL);
          if (twin) dup = { label: "Dobel dengan file lain di antrean ini", dist: 0 };
        }
        seen.push({ hash, key: d.key });
      }
      setDrafts((cur) => cur.map((x) => (x.key === d.key ? { ...x, hash, dup, skip: !!dup } : x)));
    }
  };

  const queue = drafts.filter((d) => !d.skip);
  const skipped = drafts.length - queue.length;
  const uploadAll = async () => {
    if (!me || !queue.length) return;
    if (!batch.memberId && !batch.name.trim()) return toast("Isi nama kreator", "err");
    setProgress({ done: 0, total: queue.length });
    let ok = 0;
    const failed: Draft[] = [];
    for (const d of queue) {
      try {
        const up = await compressStory(d.file);
        const ext = up.name.split(".").pop() || "webp";
        const path = `${me.id}/arsip/${d.date.slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
        const s = await supabase.storage.from("stories").upload(path, up, { contentType: up.type, cacheControl: "31536000" });
        if (s.error) throw s.error;
        const url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
        const { error } = await supabase.from("story_submissions").insert({
          is_archive: true, member_id: batch.memberId, member_name: batch.memberId ? null : batch.name.trim(),
          category: batch.memberId ? null : batch.category || null, period_month: d.date.slice(0, 7),
          story_target: null, title: null, submission_mode: "file", file_url: url, image_hash: d.hash ?? null,
          design_app: batch.app || null, wa_channel_link: batch.wa.trim() || null, qc_status: "acc",
          is_published_to_showcase: batch.publish, published_at: batch.publish ? pubInstant(d.date) : null,
        });
        if (error) throw error;
        ok++;
      } catch (e) {
        failed.push(d);
        toast(`${d.file.name}: ${errMsg(e)}`, "err");
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    setDrafts(failed);
    toast(`${ok} story arsip berhasil diunggah${batch.publish ? " & tampil di galeri" : ""}${skipped ? ` · ${skipped} duplikat dilewati` : ""}`);
    reload();
  };

  // ---------- daftar & edit ----------
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [onlyTeam, setOnlyTeam] = useState(false);
  const [onlyDup, setOnlyDup] = useState(false);
  const [edit, setEdit] = useState<ArchiveItem | null>(null);
  const items = data?.items ?? [];
  const months = useMemo(() => [...new Set(items.map((i) => i.period_month))].sort().reverse(), [items]);
  const list = items.filter((i) => (!month || i.period_month === month) && (!onlyTeam || (!i.member_id && (i.member_name ?? TEAM) === TEAM)) &&
    (!onlyDup || !!i.duplicate_of) && (!q || `${i.member_name ?? TEAM}`.toLowerCase().includes(q.toLowerCase())));
  const today = todayJakarta();

  if (loading || !data) return <PageLoader />;
  const unattributed = items.filter((i) => !i.member_id && (i.member_name ?? TEAM) === TEAM).length;
  const dupCount = items.filter((i) => i.duplicate_of).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Karya arsip" value={items.length} sub={`${months.length} bulan`} />
        <Stat label="Tampil di galeri" value={items.filter((i) => i.is_published_to_showcase).length} />
        <Stat label="Duplikat disembunyikan" value={dupCount} sub="story identik / menumpuk" />
        <Stat label="Kreator belum diisi" value={unattributed} sub="masih “Tim Credible Story”" accent={unattributed > 0} />
      </div>

      {/* Unggah massal */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-ink">Unggah story yang sudah pernah terbit</p>
            <p className="text-sm text-ink-muted">Pilih banyak gambar sekaligus (maks. 60). Gambar dikompres otomatis dan tanggal terbit diambil dari tanggal file (bisa diubah). Story yang sudah pernah diunggah terdeteksi otomatis dan dilewati.</p>
          </div>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-ink-muted transition hover:border-crimson-500 hover:text-crimson-700"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
          <ImagePlus className="h-7 w-7" />
          <span><b className="text-ink">Klik atau seret</b> gambar story (PNG/JPG/WEBP) ke sini</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {drafts.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Kreator untuk semua file">
                <CreatorPicker members={data.members} value={batch} onChange={(v) => setBatch({ ...batch, ...v })} />
              </Field>
              <Field label="Aplikasi desain (opsional)">
                <select className="input" value={batch.app} onChange={(e) => setBatch({ ...batch, app: e.target.value })}>
                  <option value="">—</option>{DESIGN_APPS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Link Channel WA (opsional)">
                <input className="input" value={batch.wa} onChange={(e) => setBatch({ ...batch, wa: e.target.value })} placeholder="https://whatsapp.com/channel/…" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d, i) => (
                <div key={d.key} className={`flex gap-3 rounded-xl border p-2.5 ${d.dup ? (d.skip ? "border-amber-300 bg-amber-50/60 opacity-75" : "border-amber-300 bg-amber-50/60") : "border-slate-200"}`}>
                  <img src={d.preview} alt="" className="h-28 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-ink-muted">Tanggal terbit
                      <input type="date" className="input mt-0.5 py-1.5 font-mono text-xs" value={d.date} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, date: e.target.value || x.date } : x)))} />
                    </label>
                    {d.hash === undefined && <p className="flex items-center gap-1 text-[11px] text-ink-muted"><Spinner className="h-3 w-3" /> Memeriksa duplikat…</p>}
                    {d.dup && (
                      <div className="rounded-lg bg-amber-100/70 px-2 py-1 text-[11px] text-amber-900">
                        <p className="flex items-center gap-1 font-semibold"><CopyIcon className="h-3 w-3" /> Identik — {d.skip ? "dilewati" : "tetap diunggah"}</p>
                        <p className="truncate">{d.dup.label}</p>
                        <button className="font-semibold underline" onClick={() => setDrafts(drafts.map((x, j) => (j === i ? { ...x, skip: !x.skip } : x)))}>{d.skip ? "Tetap unggah" : "Lewati"}</button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span className="truncate">{(d.file.size / 1024 / 1024).toFixed(1)} MB · {d.date === today ? "terbit hari ini" : d.date > today ? "terjadwal" : monthLabel(d.date.slice(0, 7))}</span>
                      <button className="rounded p-0.5 hover:bg-slate-100 hover:text-crimson-700" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} aria-label="Buang"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={batch.publish} onChange={(e) => setBatch({ ...batch, publish: e.target.checked })} /> Langsung tampilkan di galeri publik</label>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setDrafts([])} disabled={!!progress}>Batal</button>
                <button className="btn-primary" onClick={uploadAll} disabled={!!progress || !queue.length || drafts.some((d) => d.hash === undefined)}>
                  {progress ? <><Spinner /> Mengunggah {progress.done}/{progress.total}…</> : <><Upload className="h-4 w-4" /> Unggah {queue.length} story{skipped ? ` · lewati ${skipped} duplikat` : ""}</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DuplicatePanel rows={data.all} onChanged={reload} />

      {/* Kelola arsip */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari nama kreator…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan">
            <option value="">Semua bulan</option>
            {months.map((m) => <option key={m} value={m}>{emojiFor(m)} {monthLabel(m)}</option>)}
          </select>
          <button className={onlyTeam ? "btn-dark" : "btn-ghost"} onClick={() => setOnlyTeam(!onlyTeam)}>Kreator belum diisi ({unattributed})</button>
          {dupCount > 0 && <button className={onlyDup ? "btn-dark" : "btn-ghost"} onClick={() => setOnlyDup(!onlyDup)}>Duplikat ({dupCount})</button>}
        </div>
        {list.length === 0 ? <Empty title="Tidak ada karya arsip yang cocok" /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {list.map((it) => {
              const src = previewUrl(it.file_url, it.submission_mode);
              return (
                <div key={it.id} className={`group ${it.is_published_to_showcase && !it.duplicate_of ? "" : "opacity-50"}`}>
                  <button className="relative block w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: "9/16" }} onClick={() => setEdit(it)}>
                    {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink/70 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"><Pencil className="h-3 w-3" /> Ubah</span>
                    {it.duplicate_of ? <span className="badge absolute left-1.5 top-1.5 border-amber-300 bg-amber-100 text-amber-900">Duplikat</span>
                      : !it.is_published_to_showcase && <span className="badge-dark absolute left-1.5 top-1.5">Disembunyikan</span>}
                  </button>
                  <p className={`mt-1.5 truncate text-xs font-semibold ${!it.member_id && (it.member_name ?? TEAM) === TEAM ? "text-amber-700" : "text-ink"}`}>{it.member_name || TEAM}</p>
                  <p className="truncate text-[11px] text-ink-muted">{it.published_at ? `Terbit ${fmtDate(isoDate(it.published_at))}` : "Belum terbit"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {edit && <EditArchive item={edit} members={data.members} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function EditArchive({ item, members, onClose, onDone }: { item: ArchiveItem; members: MemberLite[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [creator, setCreator] = useState({ memberId: item.member_id, name: item.member_name || TEAM, category: (item.category ?? "") as Category | "" });
  const [date, setDate] = useState(isoDate(item.published_at) || `${item.period_month}-01`);
  const [app, setApp] = useState(item.design_app ?? "");
  const [wa, setWa] = useState(item.wa_channel_link ?? "");
  const [show, setShow] = useState(item.is_published_to_showcase);
  const [busy, setBusy] = useState(false);
  const src = previewUrl(item.file_url, item.submission_mode);

  const save = async () => {
    if (!creator.memberId && !creator.name.trim()) return toast("Isi nama kreator", "err");
    if (wa && !/^https:\/\//.test(wa)) return toast("Link Channel WA harus diawali https://", "err");
    setBusy(true);
    const keepTime = item.published_at && isoDate(item.published_at) === date;
    const { error } = await supabase.from("story_submissions").update({
      member_id: creator.memberId, member_name: creator.memberId ? null : creator.name.trim(),
      category: creator.memberId ? null : creator.category || null,
      period_month: date.slice(0, 7), design_app: app || null, wa_channel_link: wa.trim() || null,
      is_published_to_showcase: show, published_at: show ? (keepTime ? item.published_at : pubInstant(date)) : null,
    }).eq("id", item.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("Karya arsip diperbarui");
    onDone();
  };

  const remove = async () => {
    if (!confirm(`Hapus permanen karya ${item.member_name || TEAM} ini dari arsip? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy(true);
    const { error } = await supabase.from("story_submissions").delete().eq("id", item.id);
    if (!error) {
      const m = item.file_url.match(/\/storage\/v1\/object\/public\/stories\/(.+)$/);
      if (m) await supabase.storage.from("stories").remove([decodeURIComponent(m[1])]);
    }
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("Karya dihapus dari arsip");
    onDone();
  };

  return (
    <Modal open onClose={onClose} wide title="Ubah karya arsip"
      footer={<>
        <button className="btn-ghost mr-auto text-crimson-700" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /> Hapus</button>
        <button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Simpan</button>
      </>}>
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: "9/16" }}>
          {src && <img src={src} alt="" className="h-full w-full object-contain" />}
        </div>
        <div className="space-y-3">
          <Field label="Kreator"><CreatorPicker members={members} value={creator} onChange={setCreator} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal terbit" hint={`Masuk periode ${monthLabel(date.slice(0, 7))}`}><input type="date" className="input font-mono" value={date} onChange={(e) => setDate(e.target.value || date)} /></Field>
            <Field label="Aplikasi desain"><select className="input" value={app} onChange={(e) => setApp(e.target.value)}><option value="">—</option>{DESIGN_APPS.map((a) => <option key={a}>{a}</option>)}</select></Field>
          </div>
          <Field label="Link Channel WA (opsional)"><input className="input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://whatsapp.com/channel/…" /></Field>
          {item.duplicate_of && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Karya ini terdeteksi <b>identik</b> dengan karya lain, jadi tidak ditampilkan dua kali di galeri. Atur di panel <b>Duplikat &amp; story menumpuk</b>.</p>}
          <button type="button" className={show ? "btn-ghost" : "btn-dark"} onClick={() => setShow(!show)}>
            {show ? <><Eye className="h-4 w-4" /> Tampil di galeri — klik untuk sembunyikan</> : <><EyeOff className="h-4 w-4" /> Disembunyikan — klik untuk tampilkan</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Panel deteksi story identik / menumpuk di arsip & galeri */
function DuplicatePanel({ rows, onChanged }: { rows: DupRow[]; onChanged: () => void }) {
  const toast = useToast();
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const hashable = rows.filter((r) => r.submission_mode === "file" || r.final_url);
  const missing = hashable.filter((r) => !r.image_hash).length;
  const pool = rows.filter((r) => !r.dup_ignore && r.image_hash);
  const identical = useMemo(() => clusters(pool, DUP_IDENTICAL), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const similar = useMemo(() => {
    const ids = new Set(identical.flatMap((c) => c.items.map((i) => i.id)));
    return clusters(pool.filter((r) => !ids.has(r.id)), DUP_SIMILAR);
  }, [rows, identical]); // eslint-disable-line react-hooks/exhaustive-deps

  const rescan = async () => {
    setScan({ done: 0, total: missing });
    try {
      const fresh = await loadDupRows();
      await backfillHashes(fresh, (done, total) => setScan({ done, total }));
      const hidden = await autoResolve(fresh);
      toast(hidden ? `${hidden} story identik disembunyikan dari galeri` : "Pemindaian selesai — tidak ada duplikat baru");
      onChanged();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setScan(null);
    }
  };
  const mark = async (key: string, patch: { id: string; of: string | null }[], ignore?: string[]) => {
    setBusy(key);
    try {
      if (patch.length) { const { error } = await supabase.rpc("admin_mark_duplicates", { p: patch }); if (error) throw error; }
      if (ignore?.length) { const { error } = await supabase.rpc("admin_ignore_duplicates", { p_ids: ignore }); if (error) throw error; }
      onChanged();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  };
  const keepThis = (items: DupRow[], keep: DupRow) => mark(keep.id, items.map((i) => ({ id: i.id, of: i.id === keep.id ? null : keep.id })));
  const removeHidden = async (items: DupRow[]) => {
    const victims = items.filter((i) => i.duplicate_of && i.is_archive);
    if (!victims.length) return toast("Hanya duplikat dari arsip yang bisa dihapus dari sini", "info");
    if (!confirm(`Hapus permanen ${victims.length} duplikat arsip? Yang tampil di galeri tetap ada. Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy("del");
    const { error } = await supabase.from("story_submissions").delete().in("id", victims.map((v) => v.id));
    if (!error) {
      const paths = victims.map((v) => v.file_url.match(/\/storage\/v1\/object\/public\/stories\/(.+)$/)?.[1]).filter(Boolean).map((p) => decodeURIComponent(p!));
      if (paths.length) await supabase.storage.from("stories").remove(paths);
    }
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast(`${victims.length} duplikat dihapus`);
    onChanged();
  };

  const Group = ({ items, kind }: { items: DupRow[]; kind: "identical" | "similar" }) => {
    const keeper = items.find((i) => !i.duplicate_of && items.some((x) => x.duplicate_of === i.id)) ?? (kind === "identical" ? pickKeeper(items) : null);
    const gid = items.map((i) => i.id).join(",");
    return (
      <div className={`rounded-2xl border p-3 ${kind === "identical" ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {items.map((it) => {
            const shown = !it.duplicate_of && it.is_published_to_showcase;
            return (
              <div key={it.id} className="w-[92px] shrink-0">
                <div className={`relative overflow-hidden rounded-xl bg-slate-100 ring-2 ${keeper?.id === it.id ? "ring-emerald-500" : "ring-transparent"}`} style={{ aspectRatio: "9/16" }}>
                  <img src={previewUrl(displayUrl(it), it.final_url ? "file" : it.submission_mode) ?? ""} alt="" loading="lazy" className={`h-full w-full object-cover ${shown ? "" : "opacity-60"}`} />
                  <span className={`badge absolute left-1 top-1 text-[10px] ${shown ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white/90 text-ink-muted"}`}>{shown ? "Tampil" : it.duplicate_of ? "Disembunyikan" : "Tidak terbit"}</span>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold text-ink">{it.member_name || TEAM}</p>
                <p className="truncate text-[10px] text-ink-muted">{it.published_at ? fmtDate(isoDate(it.published_at)) : "–"}{it.is_archive ? " · arsip" : " · setoran"}</p>
                {keeper?.id !== it.id && <button className="mt-0.5 text-[10.5px] font-semibold text-crimson-700 hover:underline" disabled={!!busy} onClick={() => keepThis(items, it)}>Tampilkan yang ini</button>}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kind === "similar" && <button className="btn-soft btn-sm" disabled={!!busy} onClick={() => keepThis(items, pickKeeper(items))}>{busy === pickKeeper(items).id ? <Spinner /> : <Layers className="h-3.5 w-3.5" />} Ini story yang sama</button>}
          <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => mark(gid, items.filter((i) => i.duplicate_of).map((i) => ({ id: i.id, of: null })), items.map((i) => i.id))}>{busy === gid ? <Spinner /> : null} Bukan duplikat</button>
          {kind === "identical" && items.some((i) => i.duplicate_of && i.is_archive) && (
            <button className="btn-ghost btn-sm text-crimson-700" disabled={!!busy} onClick={() => removeHidden(items)}><Trash2 className="h-3.5 w-3.5" /> Hapus duplikat arsip</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Layers className="h-5 w-5 text-crimson-600" /> Duplikat &amp; story menumpuk</p>
          <p className="text-sm text-ink-muted">
            Setiap gambar diberi sidik visual, jadi story yang sama tetap terdeteksi walau beda format, ukuran, atau sudah diberi watermark.
            Dari story yang identik, <b className="text-ink">hanya satu yang tampil di galeri</b>.
          </p>
          <p className="mt-1 text-xs text-ink-muted">{hashable.length - missing}/{hashable.length} karya sudah dipindai{missing ? ` · ${missing} menunggu` : ""}</p>
        </div>
        <button className="btn-ghost" onClick={rescan} disabled={!!scan}>
          {scan ? <><Spinner /> Memindai {scan.done}/{scan.total}…</> : <><RefreshCw className="h-4 w-4" /> Pindai sekarang</>}
        </button>
      </div>
      {identical.length === 0 && similar.length === 0 ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{missing ? "Belum ada duplikat dari karya yang sudah dipindai." : "Tidak ada story identik — galeri bersih ✨"}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {identical.length > 0 && <p className="text-sm font-semibold text-ink">Identik ({identical.length} kelompok) <span className="font-normal text-ink-muted">· bingkai hijau = yang ditampilkan</span></p>}
          <div className="grid gap-3 lg:grid-cols-2">{identical.map((c) => <Group key={c.items.map((i) => i.id).join()} items={c.items} kind="identical" />)}</div>
          {similar.length > 0 && (
            <div>
              <button className="text-sm font-semibold text-ink-muted hover:text-ink" onClick={() => setShowSimilar(!showSimilar)}>
                {showSimilar ? "Sembunyikan" : "Lihat"} {similar.length} kelompok yang mirip (perlu dicek manual) →
              </button>
              {showSimilar && <div className="mt-3 grid gap-3 lg:grid-cols-2">{similar.map((c) => <Group key={c.items.map((i) => i.id).join()} items={c.items} kind="similar" />)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
