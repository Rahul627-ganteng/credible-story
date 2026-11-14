import { CheckCircle2, ExternalLink, FolderOpen, ImagePlus, Link2, Lock, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { PhaseBanner } from "../components/Rundown";
import { SpecialTasks } from "../components/SpecialTasks";
import { Field, PageLoader, ProgressBar, QcBadge, SectionTitle, Spinner, useToast } from "../components/ui";
import { activePeriodOf, must, previewUrl, useLive, usePeriods } from "../lib/hooks";
import { deadlinesOf, fmtDate, monthLabel, progressEmoji, quotaOf, storyNums } from "../lib/rundown";
import { compressStory } from "../lib/image";
import { imageHash } from "../lib/phash";
import { removeOriginals, uploadOriginal, type OriginalInfo } from "../lib/originals";
import { errMsg, supabase } from "../lib/supabase";
import { DESIGN_APPS, type Member, type Story } from "../lib/types";

const MAX_MB = 40; // file asli disimpan utuh untuk admin; galeri memakai versi ringan (WebP)

export default function Setoran() {
  const { member, isAdmin } = useAuth();
  const toast = useToast();
  const { data: periods, loading: lp } = usePeriods();
  const [pm, setPm] = useState("");
  useEffect(() => { if (!pm && periods?.length) setPm(activePeriodOf(periods)!.period_month); }, [periods, pm]);
  const period = periods?.find((p) => p.period_month === pm) ?? null;

  // Admin dapat menyetor atas nama member aktif (dropdown dinamis dari tabel members)
  const { data: roster } = useLive(async () => {
    if (!isAdmin) return [] as Member[];
    return must(await supabase.from("members").select("*").eq("is_active", true).eq("role", "member").order("name")) as Member[];
  }, [isAdmin], ["members"]);
  const [targetId, setTargetId] = useState("");
  useEffect(() => { if (member && !targetId) setTargetId(isAdmin ? "" : member.id); }, [member, isAdmin, targetId]);
  const target: Pick<Member, "id" | "name" | "category" | "folder_url"> | null =
    !isAdmin ? member : roster?.find((m) => m.id === targetId) ?? null;

  const { data, loading, reload } = useLive(async () => {
    if (!target || !pm) return { stories: [] as Story[] };
    const [s] = await Promise.all([
      supabase.from("story_submissions").select("*").eq("member_id", target.id).eq("period_month", pm).eq("is_archive", false).is("special_id", null).order("story_target"),
    ]);
    return { stories: must(s) as Story[] };
  }, [target?.id, pm], ["story_submissions"]);

  const [storyN, setStoryN] = useState<number>(1);
  const q = quotaOf(period);
  const dls = deadlinesOf(period);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [app, setApp] = useState("Canva");
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const stories = data?.stories ?? [];
  const existing = stories.find((s) => s.story_target === storyN);
  const canSubmit = !!period && !period.is_locked && existing?.qc_status !== "acc";
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(existing?.title ?? ""), [existing?.id, storyN, target?.id]);

  useEffect(() => {
    // pilih otomatis story pertama yang belum disetor
    const next = storyNums(q).find((n) => !stories.some((s) => s.story_target === n));
    if (next) setStoryN(next);
  }, [stories.length, target?.id]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return toast("Format harus PNG, JPG, WEBP, atau GIF", "err");
    if (f.size >= MAX_MB * 1024 * 1024) return toast(`Ukuran file harus di bawah ${MAX_MB} MB`, "err");
    setFile(f);
  };

  const submit = async () => {
    if (!target || !period || !member) return;
    setBusy(true);
    try {
      let url = link.trim();
      let hash: string | null = null;
      let orig: OriginalInfo | null = null;
      const prev = stories.find((s) => s.story_target === storyN);
      if (mode === "file") {
        if (!file) throw new Error("Pilih file gambar story terlebih dulu.");
        const up = await compressStory(file);
        hash = await imageHash(up).catch(() => null);
        const ext = up.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${member.id}/${period.period_month}/${target.id}-story${storyN}-${Date.now()}.${ext}`;
        // File asli kualitas penuh (untuk diunduh admin) + versi ringan (untuk pratinjau & galeri)
        const [r, o] = await Promise.all([
          supabase.storage.from("stories").upload(path, up, { contentType: up.type, cacheControl: "31536000" }),
          uploadOriginal(file, member.id, period.period_month, `${target.id}-story${storyN}`),
        ]);
        if (r.error) throw r.error;
        orig = o;
        url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
      } else if (!/^https:\/\/(drive\.google\.com|docs\.google\.com|www\.canva\.com|canva\.link|[\w.-]+)\//.test(url)) {
        throw new Error("Tempel link Google Drive / Canva yang valid (diawali https://).");
      }
      const { error } = await supabase.from("story_submissions").upsert({
        member_id: target.id, period_month: period.period_month, story_target: storyN,
        submission_mode: mode, file_url: url, design_app: app, title: title.trim() || null, image_hash: hash,
        original_path: orig?.original_path ?? null, original_name: orig?.original_name ?? null, original_size: orig?.original_size ?? null,
        ...(isAdmin ? {} : { qc_status: "pending_qc" }),
      }, { onConflict: "member_id,period_month,story_target" });
      if (error) { await removeOriginals([orig?.original_path]); throw error; }
      if (prev?.original_path && prev.original_path !== orig?.original_path) await removeOriginals([prev.original_path]);
      toast(mode === "file" && !orig ? `Story ${storyN} tersetor, tapi file aslinya gagal disimpan (maks. ${MAX_MB} MB) — admin akan mengunduh versi ringan.` : `Story ${storyN} tersetor! Menunggu QC admin 🎉`, mode === "file" && !orig ? "info" : undefined);
      setFile(null); setLink("");
      reload();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const removeStory = async (s: Story) => {
    if (!confirm(`Hapus setoran Story ${s.story_target}?`)) return;
    const { error } = await supabase.from("story_submissions").delete().eq("id", s.id);
    if (error) toast(errMsg(error), "err"); else { await removeOriginals([s.original_path]); toast("Setoran dihapus"); reload(); }
  };

  if (lp || !member) return <PageLoader />;
  const count = stories.length;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow={`Target ${q} story · ${period ? monthLabel(period.period_month) : ""}`}
        title="Portal Setoran Story"
        desc="Pilih target story, tulis judulnya, lalu unggah gambar (dikompres otomatis) atau tempel link Google Drive/Canva."
        action={
          <select className="input w-auto" value={pm} onChange={(e) => setPm(e.target.value)} aria-label="Periode">
            {(periods ?? []).map((p) => <option key={p.id} value={p.period_month}>{p.emoji} {monthLabel(p.period_month)}{p.is_locked ? " (terkunci)" : ""}</option>)}
          </select>
        }
      />
      <PhaseBanner period={period} compact />
      {!isAdmin && <SpecialTasks memberId={member.id} />}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap">
              {isAdmin ? (
                <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">Pilih anggota aktif…</option>
                  {(["Ikhwan", "Akhwat"] as const).map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {(roster ?? []).filter((m) => m.category === cat).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input className="input" value={member.name} disabled />
              )}
            </Field>
            <Field label="Kategori"><input className="input" value={target?.category ?? "-"} disabled /></Field>
          </div>

          {target && (loading ? <PageLoader /> : (
            <>
              <div>
                <span className="label">Target story</span>
                <div className={`grid gap-2 ${q === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                  {storyNums(q).map((n) => {
                    const done = stories.some((s) => s.story_target === n);
                    return (
                      <button key={n} type="button" onClick={() => setStoryN(n)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${storyN === n ? "border-crimson-600 bg-crimson-50 text-crimson-800 ring-2 ring-crimson-500/15" : "border-slate-300 bg-white text-ink hover:border-slate-400"}`}>
                        Story {n} (Wajib) {done && "✓"}
                        {dls[n - 1] && <span className="block text-[11px] font-medium opacity-70">tenggat {fmtDate(dls[n - 1])}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label={`Judul Story ${storyN}`} hint="Sesuai konsep yang sudah kamu taqdimkan ke admin lewat WhatsApp.">
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="mis. Adab Bertanya kepada Guru" disabled={!canSubmit} />
              </Field>

              {existing && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <div className="text-sm"><p className="font-medium text-ink">Sudah disetor</p><QcBadge s={existing} /></div>
                  {existing.qc_status === "revision" && existing.qc_notes && <p className="text-xs text-crimson-800">QC: {existing.qc_notes}</p>}
                </div>
              )}

              {canSubmit ? (
                <>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    {(["file", "link"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>
                        {m === "file" ? <><ImagePlus className="h-4 w-4" /> Upload gambar</> : <><Link2 className="h-4 w-4" /> Tempel link</>}
                      </button>
                    ))}
                  </div>
                  {mode === "file" ? (
                    <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-crimson-500"
                      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}>
                      <div className="grid h-24 w-[54px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5 text-slate-400" />}
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-ink">{file ? file.name : "Klik atau seret gambar story ke sini"}</p>
                        <p className="text-ink-muted">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `PNG/JPG/WEBP rasio 9:16 — dikompres otomatis`}</p>
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                    </label>
                  ) : (
                    <Field label="Link Google Drive / Canva" hint="Pastikan akses link: “Siapa saja yang memiliki link dapat melihat”.">
                      <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
                    </Field>
                  )}
                  <Field label="Aplikasi desain">
                    <select className="input" value={app} onChange={(e) => setApp(e.target.value)}>{DESIGN_APPS.map((a) => <option key={a}>{a}</option>)}</select>
                  </Field>
                  <button className="btn-primary w-full py-3" onClick={submit} disabled={busy || (mode === "file" ? !file : !link)}>
                    {busy ? <Spinner /> : <Upload className="h-4 w-4" />} {existing ? "Kirim ulang" : "Setor"} Story {storyN}
                  </button>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-ink-muted"><Lock className="h-4 w-4" />
                  {period?.is_locked ? "Periode ini sudah dikunci." : "Story ini sudah lolos QC."}
                </p>
              )}
            </>
          ))}
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <p className="label">Status Card {period && `· ${monthLabel(period.period_month)}`}</p>
            <div className="flex items-center gap-4">
              <p className="font-display text-5xl font-extrabold text-ink">{count}/{q}</p>
              <span className="text-4xl">{progressEmoji(count, q)}</span>
            </div>
            <p className="mb-3 text-sm text-ink-muted">{count >= q ? "Target tuntas! Barakallahu fiik 🎉" : count === q - 1 ? "Satu lagi, gaspol! 🚀" : count >= 1 ? `Lanjutkan, ${q - count} story lagi 💪` : "Belum ada setoran bulan ini."}</p>
            <ProgressBar value={count} max={q} />
            {target?.folder_url && (
              <a href={target.folder_url} target="_blank" rel="noreferrer" className="btn-ghost mt-4 w-full"><FolderOpen className="h-4 w-4" /> Cek Folder Drive {isAdmin ? target.name.split(" ")[0] : "saya"}</a>
            )}
          </div>
          <div className="card p-5">
            <p className="label">Riwayat setoran</p>
            {stories.length === 0 ? <p className="text-sm text-ink-muted">Belum ada.</p> : (
              <ul className="space-y-3">
                {stories.map((s) => {
                  const src = previewUrl(s.file_url, s.submission_mode);
                  return (
                    <li key={s.id} className="flex gap-3">
                      <div className="h-[72px] w-[41px] shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">{src && <img src={src} alt="" className="h-full w-full object-cover" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">Story {s.story_target} · {s.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5"><QcBadge s={s} /><span className="text-xs text-ink-muted">{s.design_app}</span></div>
                        {s.qc_notes && <p className="mt-1 text-xs text-ink-muted">QC: {s.qc_notes}</p>}
                        <div className="mt-1 flex gap-3 text-xs">
                          <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-crimson-700"><ExternalLink className="h-3 w-3" /> Lihat</a>
                          {s.qc_status !== "acc" && <button onClick={() => removeStory(s)} className="inline-flex items-center gap-1 text-ink-muted hover:text-crimson-700"><Trash2 className="h-3 w-3" /> Hapus</button>}
                          {s.is_published_to_showcase && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Di galeri</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
