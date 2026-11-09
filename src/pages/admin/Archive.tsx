import { Eye, EyeOff, ImagePlus, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Empty, Field, Modal, PageLoader, Spinner, Stat, useToast } from "../../components/ui";
import { must, previewUrl, useLive } from "../../lib/hooks";
import { compressStory, titleFromFilename } from "../../lib/image";
import { emojiFor, fmtDate, monthLabel, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import { DESIGN_APPS, type ArchiveItem, type Category, type Member } from "../../lib/types";

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

interface Draft { key: string; file: File; preview: string; title: string; date: string }

export default function Archive() {
  const { member: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useLive(async () => {
    const [a, m] = await Promise.all([
      supabase.from("story_submissions").select("id,member_id,member_name,category,period_month,title,submission_mode,file_url,design_app,wa_channel_link,is_published_to_showcase,published_at,is_archive,created_at").eq("is_archive", true).order("published_at", { ascending: false, nullsFirst: true }),
      supabase.from("members").select("id,name,category,is_active,role").eq("role", "member").order("name"),
    ]);
    return { items: must(a) as ArchiveItem[], members: must(m) as MemberLite[] };
  }, [], ["story_submissions"]);

  // ---------- unggah massal ----------
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [batch, setBatch] = useState({ memberId: null as string | null, name: TEAM, category: "" as Category | "", app: "", wa: "", publish: true });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => /^image\//.test(f.type)).map((f) => ({
      key: `${f.name}-${f.size}-${f.lastModified}`, file: f, preview: URL.createObjectURL(f),
      title: titleFromFilename(f.name) || "Tanpa judul", date: localDate(f.lastModified || Date.now()),
    }));
    setDrafts((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.key === n.key))].slice(0, 60));
  };

  const uploadAll = async () => {
    if (!me || !drafts.length) return;
    if (!batch.memberId && !batch.name.trim()) return toast("Isi nama kreator", "err");
    setProgress({ done: 0, total: drafts.length });
    let ok = 0;
    const failed: Draft[] = [];
    for (const d of drafts) {
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
          story_target: null, title: d.title.trim() || null, submission_mode: "file", file_url: url,
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
    toast(`${ok} story arsip berhasil diunggah${batch.publish ? " & tampil di galeri" : ""}`);
    reload();
  };

  // ---------- daftar & edit ----------
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [onlyTeam, setOnlyTeam] = useState(false);
  const [edit, setEdit] = useState<ArchiveItem | null>(null);
  const items = data?.items ?? [];
  const months = useMemo(() => [...new Set(items.map((i) => i.period_month))].sort().reverse(), [items]);
  const list = items.filter((i) => (!month || i.period_month === month) && (!onlyTeam || (!i.member_id && (i.member_name ?? TEAM) === TEAM)) &&
    (!q || `${i.title} ${i.member_name}`.toLowerCase().includes(q.toLowerCase())));
  const today = todayJakarta();

  if (loading || !data) return <PageLoader />;
  const unattributed = items.filter((i) => !i.member_id && (i.member_name ?? TEAM) === TEAM).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Karya arsip" value={items.length} sub={`${months.length} bulan`} />
        <Stat label="Tampil di galeri" value={items.filter((i) => i.is_published_to_showcase).length} />
        <Stat label="Tertaut ke member" value={items.filter((i) => i.member_id).length} />
        <Stat label="Kreator belum diisi" value={unattributed} sub="masih “Tim Credible Story”" accent={unattributed > 0} />
      </div>

      {/* Unggah massal */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-ink">Unggah story yang sudah pernah terbit</p>
            <p className="text-sm text-ink-muted">Pilih banyak gambar sekaligus (maks. 60). Gambar dikompres otomatis; judul diambil dari nama file dan tanggal dari tanggal file — semuanya bisa diubah sebelum diunggah.</p>
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
                <div key={d.key} className="flex gap-3 rounded-xl border border-slate-200 p-2.5">
                  <img src={d.preview} alt="" className="h-28 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input className="input py-1.5 text-sm" value={d.title} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Judul" />
                    <input type="date" className="input py-1.5 font-mono text-xs" value={d.date} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, date: e.target.value || x.date } : x)))} />
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
                <button className="btn-primary" onClick={uploadAll} disabled={!!progress}>
                  {progress ? <><Spinner /> Mengunggah {progress.done}/{progress.total}…</> : <><Upload className="h-4 w-4" /> Unggah {drafts.length} story</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kelola arsip */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari judul atau kreator…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan">
            <option value="">Semua bulan</option>
            {months.map((m) => <option key={m} value={m}>{emojiFor(m)} {monthLabel(m)}</option>)}
          </select>
          <button className={onlyTeam ? "btn-dark" : "btn-ghost"} onClick={() => setOnlyTeam(!onlyTeam)}>Kreator belum diisi ({unattributed})</button>
        </div>
        {list.length === 0 ? <Empty title="Tidak ada karya arsip yang cocok" /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {list.map((it) => {
              const src = previewUrl(it.file_url, it.submission_mode);
              return (
                <div key={it.id} className={`group ${it.is_published_to_showcase ? "" : "opacity-50"}`}>
                  <button className="relative block w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: "9/16" }} onClick={() => setEdit(it)}>
                    {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink/70 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"><Pencil className="h-3 w-3" /> Ubah</span>
                    {!it.is_published_to_showcase && <span className="badge-dark absolute left-1.5 top-1.5">Disembunyikan</span>}
                  </button>
                  <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-ink">{it.title || "Tanpa judul"}</p>
                  <p className={`truncate text-[11px] ${!it.member_id && (it.member_name ?? TEAM) === TEAM ? "text-amber-700" : "text-ink-muted"}`}>{it.member_name || TEAM} · {it.published_at ? fmtDate(isoDate(it.published_at)) : "–"}</p>
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
  const [title, setTitle] = useState(item.title ?? "");
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
      category: creator.memberId ? null : creator.category || null, title: title.trim() || null,
      period_month: date.slice(0, 7), design_app: app || null, wa_channel_link: wa.trim() || null,
      is_published_to_showcase: show, published_at: show ? (keepTime ? item.published_at : pubInstant(date)) : null,
    }).eq("id", item.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("Karya arsip diperbarui");
    onDone();
  };

  const remove = async () => {
    if (!confirm(`Hapus permanen “${item.title || "karya ini"}” dari arsip? Tindakan ini tidak bisa dibatalkan.`)) return;
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
          <Field label="Judul"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Kreator"><CreatorPicker members={members} value={creator} onChange={setCreator} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal terbit" hint={`Masuk periode ${monthLabel(date.slice(0, 7))}`}><input type="date" className="input font-mono" value={date} onChange={(e) => setDate(e.target.value || date)} /></Field>
            <Field label="Aplikasi desain"><select className="input" value={app} onChange={(e) => setApp(e.target.value)}><option value="">—</option>{DESIGN_APPS.map((a) => <option key={a}>{a}</option>)}</select></Field>
          </div>
          <Field label="Link Channel WA (opsional)"><input className="input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://whatsapp.com/channel/…" /></Field>
          <button type="button" className={show ? "btn-ghost" : "btn-dark"} onClick={() => setShow(!show)}>
            {show ? <><Eye className="h-4 w-4" /> Tampil di galeri — klik untuk sembunyikan</> : <><EyeOff className="h-4 w-4" /> Disembunyikan — klik untuk tampilkan</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
