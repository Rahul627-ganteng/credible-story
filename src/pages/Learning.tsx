import { BookOpen, ExternalLink, Image as ImageIcon, Play, RefreshCw, Search, Sparkles, Target, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Empty, Field, Markdown, Modal, PageLoader, SectionTitle, Spinner, useToast } from "../components/ui";
import { must, useLive } from "../lib/hooks";
import { fmtDate, fmtDateTime } from "../lib/rundown";
import { supabase } from "../lib/supabase";
import type { GenerationRun, LearningMaterial, PinterestPin, YoutubeVideo } from "../lib/types";

const GEN_APPS = ["Canva", "Figma", "Photoshop", "Illustrator", "After Effects", "CapCut", "PixelLab", "Alight Motion"];
const GEN_LEVELS = ["Easy", "Intermediate", "Advanced"] as const;

const levelCls: Record<string, string> = { Easy: "badge-green", Intermediate: "badge-amber", Advanced: "badge-red" };

const ytQuery = (m: LearningMaterial) => m.youtube_query || `tutorial ${m.design_app} ${m.title}`;
const ytSearchUrl = (m: LearningMaterial) => `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery(m))}`;

/** Gambar referensi dari Pinterest — memakai embed resmi Pinterest (gambar tetap milik & tertaut ke pemiliknya) */
function PinsSection({ m, isAdmin }: { m: LearningMaterial; isAdmin: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pins: PinterestPin[] = Array.isArray(m.pins) ? m.pins : [];
  const search = m.pinterest_moodboard?.[0]?.pinterest_url ?? `https://id.pinterest.com/search/pins/?q=${encodeURIComponent(`${m.design_app} ${m.title}`)}`;
  const refresh = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("generate-materials", { body: { action: "pins", id: m.id } });
    setBusy(false);
    if (error) return toast(error.message, "err");
    toast("Mencari gambar Pinterest… hasilnya muncul otomatis dalam ±30 detik", "info");
  };
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label !mb-0 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-crimson-600" /> Referensi visual dari Pinterest</p>
        <div className="flex gap-1.5">
          {isAdmin && <button className="btn-ghost btn-sm" onClick={refresh} disabled={busy}>{busy ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Cari ulang</button>}
          <a href={search} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><Search className="h-3.5 w-3.5" /> Lihat lebih banyak</a>
        </div>
      </div>
      {pins.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-ink-muted">
          {m.pins_checked_at ? "Belum ketemu pin yang pas untuk materi ini — buka “Lihat lebih banyak” untuk menjelajah langsung di Pinterest." : "Gambar referensi sedang dicarikan otomatis…"}
        </p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
          {pins.map((p) => (
            <div key={p.id} className="w-[184px] shrink-0">
              <div className="relative h-[384px] w-[184px] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                <iframe
                  src={`https://assets.pinterest.com/ext/embed.html?id=${p.id}`}
                  title={`Pin Pinterest ${p.id}`}
                  loading="lazy"
                  scrolling="no"
                  className="absolute left-0 top-0 origin-top-left border-0"
                  style={{ width: 345, height: 720, transform: "scale(0.5333)" }}
                />
              </div>
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-crimson-700 hover:underline">Buka di Pinterest <ExternalLink className="h-3 w-3" /></a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Generate materi baru: pilih aplikasi & tingkat (kosong = gabungan semuanya) */
function GenerateModal({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: () => void }) {
  const toast = useToast();
  const [apps, setApps] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-ink-body hover:border-slate-400"}`;
  const summary = `${count} materi · ${apps.length ? apps.join(", ") : "semua aplikasi (acak)"} · ${levels.length ? levels.join(", ") : "campuran Easy–Advanced"}${topic.trim() ? ` · topik “${topic.trim()}”` : ""}`;

  const run = async () => {
    setBusy(true);
    const { data: res, error } = await supabase.functions.invoke("generate-materials", { body: { trigger: "manual", apps, levels, count, topic: topic.trim() } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* abaikan */ }
      return toast(msg, "err");
    }
    if ((res as { started?: boolean })?.started) {
      toast(`AI sedang meriset ${count} materi… hasil muncul otomatis dalam 1–2 menit.`, "info");
      onStarted();
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate materi baru"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Wand2 className="h-4 w-4" />} Generate {count} materi</button>
      </>}>
      <div className="space-y-5">
        <div>
          <p className="label">Aplikasi <span className="font-normal normal-case text-ink-muted">· boleh pilih lebih dari satu</span></p>
          <div className="flex flex-wrap gap-2">
            <button className={chip(apps.length === 0)} onClick={() => setApps([])}>✦ Gabungan semua</button>
            {GEN_APPS.map((a) => <button key={a} className={chip(apps.includes(a))} onClick={() => toggle(apps, a, setApps)}>{a}</button>)}
          </div>
        </div>
        <div>
          <p className="label">Tingkatan</p>
          <div className="flex flex-wrap gap-2">
            <button className={chip(levels.length === 0)} onClick={() => setLevels([])}>✦ Campuran semua level</button>
            {GEN_LEVELS.map((l) => <button key={l} className={chip(levels.includes(l))} onClick={() => toggle(levels, l, setLevels)}>{l}</button>)}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div>
            <p className="label">Jumlah</p>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setCount(n)} className={`h-8 w-9 rounded-lg text-sm font-bold ${count === n ? "bg-ink text-white" : "text-ink-muted"}`}>{n}</button>)}
            </div>
          </div>
          <Field label="Topik / fokus (opsional)"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="mis. Maulid Nabi, tipografi Arab, story Ramadhan" maxLength={200} /></Field>
        </div>
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-ink-body"><b className="text-ink">Ringkasan:</b> {summary}. Setiap materi otomatis dilengkapi video YouTube &amp; gambar referensi Pinterest.</p>
      </div>
    </Modal>
  );
}

/** Video tutorial YouTube untuk satu materi: pemutar ringan (iframe baru dimuat saat diketuk) + tombol cari. */
function VideoSection({ m }: { m: LearningMaterial }) {
  const videos: YoutubeVideo[] = Array.isArray(m.videos) ? m.videos : [];
  const [active, setActive] = useState<YoutubeVideo | null>(videos[0] ?? null);
  const [playing, setPlaying] = useState(false);

  const searchBtn = (
    <a href={ytSearchUrl(m)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
      <Search className="h-3.5 w-3.5" /> Cari di YouTube
    </a>
  );

  if (!active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Play className="h-4 w-4 fill-crimson-600 text-crimson-600" /> Video tutorial</p>
          <p className="truncate text-xs text-ink-muted">Kata kunci: “{ytQuery(m)}”</p>
        </div>
        {searchBtn}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="label flex items-center gap-1.5"><Play className="h-3.5 w-3.5 fill-crimson-600 text-crimson-600" /> Video tutorial</p>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {playing ? (
          <iframe
            key={active.id}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`Putar video: ${active.title}`}>
            <img src={`https://i.ytimg.com/vi/${active.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-crimson-600 shadow-lg transition group-hover:scale-110">
                <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{active.title}</p>
          <p className="text-xs text-ink-muted">{active.channel}</p>
        </div>
        <a href={`https://www.youtube.com/watch?v=${active.id}`} target="_blank" rel="noreferrer" className="shrink-0 text-ink-muted hover:text-ink" title="Buka di YouTube"><ExternalLink className="h-4 w-4" /></a>
      </div>
      {videos.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {videos.map((v) => (
            <button key={v.id} onClick={() => { setActive(v); setPlaying(true); }}
              className={`w-36 shrink-0 text-left ${v.id === active.id ? "" : "opacity-70 hover:opacity-100"}`}>
              <span className={`relative block aspect-video overflow-hidden rounded-lg bg-slate-200 ${v.id === active.id ? "ring-2 ring-crimson-500" : ""}`}>
                <img src={v.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
              <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-tight text-ink">{v.title}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end">{searchBtn}</div>
    </div>
  );
}

export default function Learning() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading } = useLive(async () => {
    const [m, r] = await Promise.all([
      supabase.from("learning_materials").select("*").order("batch_date", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("learning_generation_runs").select("*").order("started_at", { ascending: false }).limit(1),
    ]);
    return { materials: must(m) as LearningMaterial[], lastRun: (must(r) as GenerationRun[])[0] ?? null };
  }, [], ["learning_materials", "learning_generation_runs"]);

  const [level, setLevel] = useState("");
  const [app, setApp] = useState("");
  const [openId, setOpen] = useState<LearningMaterial | null>(null);
  const [busy, setBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);

  const materials = data?.materials ?? [];
  // Ambil versi terbaru materi yang sedang dibuka (video/pin bisa masuk belakangan lewat realtime)
  const open = openId ? materials.find((m) => m.id === openId.id) ?? openId : null;
  const apps = useMemo(() => [...new Set(materials.map((m) => m.design_app))].sort(), [materials]);
  const filtered = materials.filter((m) => (!level || m.difficulty_level === level) && (!app || m.design_app === app));
  const batches = useMemo(() => {
    const map = new Map<string, LearningMaterial[]>();
    filtered.forEach((m) => map.set(m.batch_date, [...(map.get(m.batch_date) ?? []), m]));
    return [...map.entries()];
  }, [filtered]);

  const [genOpen, setGenOpen] = useState(false);
  const findPins = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("generate-materials", { body: { action: "pins" } });
    setBusy(false);
    if (error) return toast(error.message, "err");
    toast("Mencari gambar Pinterest untuk materi yang belum punya… hasil muncul otomatis bertahap.", "info");
  };

  const findVideos = async () => {
    setVidBusy(true);
    const { data: res, error } = await supabase.functions.invoke("generate-materials", { body: { action: "videos" } });
    setVidBusy(false);
    if (error) {
      let msg = error.message;
      try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* abaikan */ }
      return toast(msg, "err");
    }
    const r = res as { checked: number; filled: number; error?: string | null };
    if (r.checked === 0) return toast("Semua materi sudah punya video. 👍", "info");
    toast(`Video ditemukan untuk ${r.filled} dari ${r.checked} materi${r.error ? " — sisanya dilanjutkan otomatis (kuota harian)" : ""}.`);
  };

  const run = data?.lastRun;
  const running = run?.status === "running" && Date.now() - new Date(run.started_at).getTime() < 5 * 60 * 1000;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Khusus anggota"
        title="Learning Hub Desain"
        desc="5 materi baru setiap 2 hari hasil riset AI dari web & Pinterest — lintas Canva, Figma, Photoshop, Illustrator, After Effects, CapCut, PixelLab, dan Alight Motion."
        action={isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={findVideos} disabled={vidBusy} title="Cari video YouTube untuk materi yang belum punya video">
              {vidBusy ? <Spinner /> : <Play className="h-4 w-4" />} Cari video
            </button>
            <button className="btn-ghost" onClick={findPins} disabled={busy} title="Cari gambar Pinterest untuk materi yang belum punya">
              {busy ? <Spinner /> : <ImageIcon className="h-4 w-4" />} Cari gambar Pinterest
            </button>
            <button className="btn-primary" onClick={() => setGenOpen(true)} disabled={running}>
              {running ? <Spinner /> : <Wand2 className="h-4 w-4" />} {running ? "Sedang meriset…" : "Generate Materi Baru"}
            </button>
          </div>
        )}
      />

      {isAdmin && run && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${run.status === "error" ? "border-crimson-200 bg-crimson-50 text-crimson-800" : run.status === "running" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-ink-muted"}`}>
          <b>Proses terakhir ({run.trigger === "cron" ? "otomatis 48 jam" : "manual"}, {fmtDateTime(run.started_at)}):</b>{" "}
          {run.status === "running" ? `sedang berjalan… (${run.message ?? ""})` : run.status === "success" ? `berhasil, ${run.materials_created} materi (${run.message})` : run.status === "skipped" ? "dilewati — batch terakhir masih baru" : run.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {["", "Easy", "Intermediate", "Advanced"].map((l) => (
          <button key={l || "all"} onClick={() => setLevel(l)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${level === l ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>{l || "Semua level"}</button>
        ))}
        <select className="input w-auto py-1.5" value={app} onChange={(e) => setApp(e.target.value)} aria-label="Aplikasi">
          <option value="">Semua aplikasi</option>
          {apps.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {loading ? <PageLoader /> : batches.length === 0 ? (
        <Empty icon={<BookOpen className="h-8 w-8" />} title="Belum ada materi">Materi akan muncul otomatis setiap 2 hari.</Empty>
      ) : batches.map(([date, items]) => (
        <section key={date}>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-crimson-600" /> Batch {fmtDate(date, true)} <span className="text-ink-muted">· {items.length} materi</span></p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <button key={m.id} onClick={() => setOpen(m)} className="card group flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="mb-3 flex items-center gap-2">
                  <span className={levelCls[m.difficulty_level]}>{m.difficulty_level}</span><span className="badge-slate">{m.design_app}</span>
                  <span className="ml-auto inline-flex items-center gap-2 text-[11px] font-semibold text-crimson-700">
                    {m.videos?.length > 0 && <span className="inline-flex items-center gap-1"><Play className="h-3 w-3 fill-current" /> {m.videos.length}</span>}
                    {m.pins?.length > 0 && <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {m.pins.length}</span>}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold leading-snug text-ink group-hover:text-crimson-700">{m.title}</h3>
                <p className="mt-1.5 line-clamp-3 text-sm text-ink-muted">{m.summary}</p>
                {m.pinterest_moodboard?.length > 0 && (
                  <div className="mt-auto flex gap-1 pt-4">
                    {m.pinterest_moodboard.flatMap((x) => x.palette).slice(0, 8).map((c, i) => <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/5" style={{ background: c }} />)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {isAdmin && <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} onStarted={() => undefined} />}

      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open && (
        <span className="flex flex-col gap-1">
          <span className="flex gap-2"><span className={levelCls[open.difficulty_level]}>{open.difficulty_level}</span><span className="badge-slate">{open.design_app}</span></span>
          {open.title}
        </span>
      )}>
        {open && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-4 text-[15px] font-medium text-ink">{open.summary}</p>
              <div className="mb-5"><VideoSection key={open.id} m={open} /></div>
              <Markdown>{open.tutorial_markdown}</Markdown>
            </div>
            <div className="space-y-5">
              <PinsSection key={`pins-${open.id}`} m={open} isAdmin={isAdmin} />
              <div>
                <p className="label">Bedah visual · Moodboard Pinterest</p>
                <div className="space-y-3">
                  {open.pinterest_moodboard.map((mb, i) => (
                    <a key={i} href={mb.pinterest_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 transition hover:border-crimson-300">
                      <div className="mb-2 flex h-10 overflow-hidden rounded-lg">{mb.palette.map((c) => <span key={c} className="flex-1" style={{ background: c }} title={c} />)}</div>
                      <p className="flex items-center justify-between text-sm font-semibold text-ink">{mb.title} <ExternalLink className="h-3.5 w-3.5 text-ink-muted" /></p>
                      <p className="text-xs text-ink-muted">{mb.note}</p>
                      <p className="mt-1 font-mono text-[10px] text-ink-muted">{mb.palette.join(" · ")}</p>
                    </a>
                  ))}
                </div>
              </div>
              {open.challenge_task && (
                <div className="rounded-xl bg-ink p-4 text-white">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-crimson-200"><Target className="h-3.5 w-3.5" /> Tantangan desain</p>
                  <p className="mt-1.5 text-sm leading-relaxed">{open.challenge_task}</p>
                </div>
              )}
              {open.sources?.length > 0 && (
                <div>
                  <p className="label">Sumber riset</p>
                  <ul className="space-y-1 text-xs">{open.sources.map((s, i) => <li key={i}><a className="text-crimson-700 underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
