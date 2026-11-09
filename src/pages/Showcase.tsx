import { ArrowDown, CalendarDays, ExternalLink, Filter, ImageOff, MessageCircle, Search, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal, PageLoader } from "../components/ui";
import { must, previewUrl, useLive } from "../lib/hooks";
import { emojiFor, fmtDate, monthLabel, todayJakarta } from "../lib/rundown";
import { supabase } from "../lib/supabase";
import type { ShowcaseItem } from "../lib/types";

const PAGE = 24;
const jakartaDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "";

function StoryCard({ it, onOpen, size = "md" }: { it: ShowcaseItem; onOpen: (i: ShowcaseItem) => void; size?: "md" | "lg" }) {
  const src = previewUrl(it.file_url, it.submission_mode);
  return (
    <button onClick={() => onOpen(it)} className={`group text-left ${size === "lg" ? "w-[200px] shrink-0 snap-start sm:w-[220px]" : ""}`}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift" style={{ aspectRatio: "9/16" }}>
        {src ? (
          <img src={src} alt={it.title ?? "Story"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-muted">
            <ExternalLink className="h-6 w-6" /> Karya dari tautan {it.file_url.includes("canva") ? "Canva" : "eksternal"}
          </div>
        )}
        <span className="badge absolute left-2 top-2 border-white/40 bg-white/85 text-ink backdrop-blur">{emojiFor(it.period_month)} {monthLabel(it.period_month).replace(/ \d{4}$/, (y) => " '" + y.trim().slice(2))}</span>
      </div>
      <p className="mt-2 line-clamp-2 font-display text-sm font-bold leading-snug text-ink">{it.title}</p>
      <p className="truncate text-xs text-ink-muted">{it.member_name}{it.design_app ? ` · ${it.design_app}` : ""}</p>
    </button>
  );
}

export default function Showcase() {
  const { data, loading } = useLive(async () => {
    const [items, settings] = await Promise.all([supabase.rpc("showcase_list"), supabase.rpc("public_settings")]);
    const s = must(settings) as { key: string; value: string }[];
    return { items: must(items) as ShowcaseItem[], channel: s.find((x) => x.key === "wa_channel_url")?.value || "" };
  }, [], ["story_submissions"]);

  const [q, setQ] = useState("");
  const [creator, setCreator] = useState("");
  const [cat, setCat] = useState("");
  const [month, setMonth] = useState("");
  const [app, setApp] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<ShowcaseItem | null>(null);

  const items = data?.items ?? [];
  const today = todayJakarta();
  const todays = useMemo(() => items.filter((i) => jakartaDate(i.published_at) === today), [items, today]);
  const highlight = todays.length ? todays : items.slice(0, 8);
  const latestDate = jakartaDate(items[0]?.published_at ?? null);

  const opts = useMemo(() => ({
    creators: [...new Set(items.map((i) => i.member_name))].sort((a, b) => a.localeCompare(b, "id")),
    months: [...new Set(items.map((i) => i.period_month))].sort().reverse(),
    apps: [...new Set(items.map((i) => i.design_app).filter(Boolean) as string[])].sort(),
  }), [items]);

  const filtered = items.filter((i) =>
    (!creator || i.member_name === creator) && (!cat || i.category === cat) && (!month || i.period_month === month) &&
    (!app || i.design_app === app) &&
    (!q || `${i.title} ${i.member_name}`.toLowerCase().includes(q.toLowerCase())));
  useEffect(() => setShown(PAGE), [creator, cat, month, app, q]);

  const channelFor = (i: ShowcaseItem) => i.wa_channel_link || data?.channel || "";
  const reset = () => { setCreator(""); setCat(""); setMonth(""); setApp(""); setQ(""); };
  const active = [creator, cat, month, app, q].filter(Boolean).length;

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-crimson-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <img src="/brand/mark-black.webp" alt="" className="h-10 w-auto" />
              <span className="h-8 w-px bg-slate-300" />
              <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.18em] text-ink-muted">Official Story of<br />Credible Generation</span>
            </div>
            <h1 className="leading-[0.95]">
              <span className="block font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl lg:text-7xl">CREDIBLE STORY</span>
              <span className="mt-3 block bg-crimson-grad bg-clip-text font-display text-[26px] font-extrabold tracking-tight text-transparent sm:text-4xl lg:text-[44px]">
                SEBARKAN KEBAIKANMU HARI INI!
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-muted">
              Pengingat kebaikan dalam format story 9:16 — dirancang dengan adab oleh para kreator Ikhwan &amp; Akhwat Credible Generation, terbit setiap bulan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#sorotan" className="btn-primary"><Sparkles className="h-4 w-4" /> {todays.length ? "Lihat yang terbit hari ini" : "Lihat karya terbaru"}</a>
              {data?.channel && (
                <a href={data.channel} target="_blank" rel="noreferrer" className="btn-ghost"><MessageCircle className="h-4 w-4" /> Channel WhatsApp</a>
              )}
              <Link to="/daftar" className="btn-ghost"><UserPlus className="h-4 w-4" /> Gabung Tim Kreator</Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[[items.length, "karya terbit"], [opts.creators.filter((c) => c !== "Tim Credible Story").length, "kreator"], [opts.months.length, "bulan berkarya"]].map(([v, l]) => (
                <div key={String(l)}>
                  <dt className="font-display text-3xl font-extrabold text-ink">{loading ? "–" : v}</dt>
                  <dd className="text-xs font-medium uppercase tracking-wide text-ink-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative hidden h-[460px] md:block">
            {highlight.slice(0, 3).map((it, idx) => {
              const src = previewUrl(it.file_url, it.submission_mode);
              const pos = ["left-2 top-10 -rotate-6", "left-1/2 top-0 z-10 -translate-x-1/2", "right-2 top-12 rotate-6"][idx];
              return (
                <button key={it.id} onClick={() => setOpen(it)} className={`absolute w-[200px] overflow-hidden rounded-[22px] border-4 border-white bg-slate-100 shadow-lift transition hover:scale-[1.03] ${pos}`} style={{ aspectRatio: "9/16" }}>
                  {src && <img src={src} alt={it.title ?? ""} className="h-full w-full object-cover" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= SOROTAN: TERBIT HARI INI ================= */}
      <section id="sorotan" className="scroll-mt-20 border-b border-slate-200 bg-gradient-to-b from-crimson-50/60 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                {todays.length ? <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-crimson-600" /></span> Hari ini · {fmtDate(today, true)}</> : <><CalendarDays className="h-3.5 w-3.5" /> Terakhir terbit {latestDate ? fmtDate(latestDate, true) : "-"}</>}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{todays.length ? "Terbit Hari Ini" : "Karya Terbaru"}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {todays.length ? `${todays.length} story baru dibagikan hari ini. Jangan lupa sebarkan kebaikannya!` : "Belum ada story yang terbit hari ini — ini karya terbaru dari tim."}
              </p>
            </div>
            <a href="#galeri" className="inline-flex items-center gap-1 text-sm font-semibold text-crimson-700">Semua karya <ArrowDown className="h-4 w-4" /></a>
          </div>
          {loading ? <PageLoader /> : highlight.length === 0 ? (
            <Empty icon={<ImageOff className="h-8 w-8" />} title="Belum ada karya terbit" />
          ) : (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 scrollbar-thin">
              {highlight.map((it) => <StoryCard key={it.id} it={it} onOpen={setOpen} size="lg" />)}
            </div>
          )}
        </div>
      </section>

      {/* ================= GALERI ================= */}
      <section id="galeri" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-12">
        <div className="mb-5">
          <p className="eyebrow">Galeri Kurasi</p>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Semua Karya Credible Story</h2>
        </div>
        <div className="card mb-6 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Cari judul atau kreator…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input w-auto" value={creator} onChange={(e) => setCreator(e.target.value)} aria-label="Pembuat">
              <option value="">Semua kreator</option>
              {opts.creators.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
              <option value="">Ikhwan &amp; Akhwat</option>
              <option>Ikhwan</option>
              <option>Akhwat</option>
            </select>
            <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan">
              <option value="">Semua bulan</option>
              {opts.months.map((m) => <option key={m} value={m}>{emojiFor(m)} {monthLabel(m)}</option>)}
            </select>
            {opts.apps.length > 0 && (
              <select className="input w-auto" value={app} onChange={(e) => setApp(e.target.value)} aria-label="Aplikasi">
                <option value="">Semua aplikasi</option>
                {opts.apps.map((a) => <option key={a}>{a}</option>)}
              </select>
            )}
            {active > 0 && <button className="btn-ghost btn-sm" onClick={reset}><Filter className="h-3.5 w-3.5" /> Reset ({active})</button>}
          </div>
          {active > 0 && <p className="mt-2 px-1 text-xs text-ink-muted">{filtered.length} karya cocok</p>}
        </div>

        {loading ? <PageLoader label="Memuat galeri…" /> : filtered.length === 0 ? (
          <Empty icon={<ImageOff className="h-8 w-8" />} title="Belum ada karya yang cocok">Coba ubah filter atau kata kunci pencarian.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.slice(0, shown).map((it) => <StoryCard key={it.id} it={it} onOpen={setOpen} />)}
            </div>
            {shown < filtered.length && (
              <div className="mt-8 flex justify-center">
                <button className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>Muat lebih banyak ({filtered.length - shown} lagi)</button>
              </div>
            )}
          </>
        )}
      </section>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? "Karya"} wide>
        {open && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
            <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" style={{ aspectRatio: "9/16" }}>
              {previewUrl(open.file_url, open.submission_mode) ? (
                <img src={previewUrl(open.file_url, open.submission_mode)!} alt={open.title ?? ""} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-muted">Pratinjau tidak tersedia untuk tautan ini.</div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {open.category && <span className="badge-dark">{open.category}</span>}
                <span className="badge-slate">{emojiFor(open.period_month)} {monthLabel(open.period_month)}</span>
                {open.story_target && <span className="badge-slate">Story {open.story_target}</span>}
                {open.design_app && <span className="badge-red">{open.design_app}</span>}
              </div>
              <div>
                <p className="label">Kreator</p>
                <p className="font-display text-lg font-bold text-ink">{open.member_name}</p>
                {open.published_at && <p className="text-sm text-ink-muted">Terbit {fmtDate(jakartaDate(open.published_at), true)}</p>}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {channelFor(open) ? (
                  <a className="btn-primary" href={channelFor(open)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> Baca di Channel WA Credible Story
                  </a>
                ) : (
                  <span className="text-xs text-ink-muted">Tautan Channel WA belum diatur admin.</span>
                )}
                {open.submission_mode === "link" ? (
                  <a className="btn-ghost" href={open.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Buka karya</a>
                ) : (
                  <a className="btn-ghost" href={open.file_url} download target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Buka ukuran penuh</a>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
