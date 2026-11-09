import { ArrowUpRight, ExternalLink, Filter, ImageOff, MessageCircle, Search, Sparkles, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal, PageLoader } from "../components/ui";
import { must, previewUrl, useLive } from "../lib/hooks";
import { emojiFor, monthLabel } from "../lib/rundown";
import { supabase } from "../lib/supabase";
import type { ShowcaseItem } from "../lib/types";

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
  const [open, setOpen] = useState<ShowcaseItem | null>(null);

  const items = data?.items ?? [];
  const opts = useMemo(() => ({
    creators: [...new Set(items.map((i) => i.member_name))].sort((a, b) => a.localeCompare(b, "id")),
    months: [...new Set(items.map((i) => i.period_month))].sort().reverse(),
    apps: [...new Set(items.map((i) => i.design_app).filter(Boolean) as string[])].sort(),
  }), [items]);

  const filtered = items.filter((i) =>
    (!creator || i.member_name === creator) && (!cat || i.category === cat) && (!month || i.period_month === month) &&
    (!app || i.design_app === app) &&
    (!q || `${i.title} ${i.member_name}`.toLowerCase().includes(q.toLowerCase())));

  const channelFor = (i: ShowcaseItem) => i.wa_channel_link || data?.channel || "";
  const reset = () => { setCreator(""); setCat(""); setMonth(""); setApp(""); setQ(""); };
  const active = [creator, cat, month, app, q].filter(Boolean).length;

  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <span className="badge-red mb-4"><Sparkles className="h-3 w-3" /> Galeri Kurasi Karya</span>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              Story yang <span className="bg-crimson-grad bg-clip-text text-transparent">kredibel</span>,<br />dikerjakan dengan adab.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-muted">
              Kumpulan karya story 9:16 Tim Credible Story yang sudah lolos taqdim konsep dan quality control — disusun ulang setiap bulan oleh para kreator Ikhwan &amp; Akhwat.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {data?.channel ? (
                <a href={data.channel} target="_blank" rel="noreferrer" className="btn-primary">
                  <MessageCircle className="h-4 w-4" /> Ikuti Channel WA Credible Story
                </a>
              ) : (
                <a href="#galeri" className="btn-primary">Lihat Karya <ArrowUpRight className="h-4 w-4" /></a>
              )}
              <Link to="/daftar" className="btn-ghost"><UserPlus className="h-4 w-4" /> Gabung Tim Kreator</Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                [items.length, "karya terbit"],
                [opts.creators.length, "kreator"],
                [opts.months.length, "periode"],
              ].map(([v, l]) => (
                <div key={String(l)}>
                  <dt className="font-display text-3xl font-extrabold text-ink">{loading ? "–" : v}</dt>
                  <dd className="text-xs font-medium uppercase tracking-wide text-ink-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative hidden h-[420px] md:block">
            {items.slice(0, 3).map((it, idx) => {
              const src = previewUrl(it.file_url, it.submission_mode);
              const pos = ["left-6 top-6 -rotate-6", "left-1/2 top-0 -translate-x-1/2 z-10", "right-6 top-8 rotate-6"][idx];
              return (
                <div key={it.id} className={`absolute w-[190px] overflow-hidden rounded-[22px] border-4 border-white bg-slate-100 shadow-lift ${pos}`} style={{ aspectRatio: "9/16" }}>
                  {src && <img src={src} alt={it.title ?? ""} className="h-full w-full object-cover" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="galeri" className="mx-auto max-w-6xl px-4 pt-10">
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
            <select className="input w-auto" value={app} onChange={(e) => setApp(e.target.value)} aria-label="Aplikasi">
              <option value="">Semua aplikasi</option>
              {opts.apps.map((a) => <option key={a}>{a}</option>)}
            </select>
            {active > 0 && <button className="btn-ghost btn-sm" onClick={reset}><Filter className="h-3.5 w-3.5" /> Reset ({active})</button>}
          </div>
        </div>

        {loading ? <PageLoader label="Memuat galeri…" /> : filtered.length === 0 ? (
          <Empty icon={<ImageOff className="h-8 w-8" />} title="Belum ada karya yang cocok">Coba ubah filter atau kata kunci pencarian.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((it) => {
              const src = previewUrl(it.file_url, it.submission_mode);
              return (
                <button key={it.id} onClick={() => setOpen(it)} className="group text-left">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card transition group-hover:-translate-y-1 group-hover:shadow-lift" style={{ aspectRatio: "9/16" }}>
                    {src ? (
                      <img src={src} alt={it.title ?? "Story"} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-muted">
                        <ExternalLink className="h-6 w-6" /> Karya dari tautan {it.file_url.includes("canva") ? "Canva" : "eksternal"}
                      </div>
                    )}
                    <span className="badge absolute left-2 top-2 border-white/40 bg-white/85 text-ink backdrop-blur">{emojiFor(it.period_month)} {monthLabel(it.period_month).split(" ")[0]}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-display text-sm font-bold leading-snug text-ink">{it.title}</p>
                  <p className="text-xs text-ink-muted">{it.member_name} · {it.design_app}</p>
                </button>
              );
            })}
          </div>
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
                <span className="badge-dark">{open.category}</span>
                <span className="badge-slate">{emojiFor(open.period_month)} {monthLabel(open.period_month)}</span>
                <span className="badge-slate">Story {open.story_target}</span>
                {open.design_app && <span className="badge-red">{open.design_app}</span>}
              </div>
              <div>
                <p className="label">Kreator</p>
                <p className="font-display text-lg font-bold text-ink">{open.member_name}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {channelFor(open) ? (
                  <a className="btn-primary" href={channelFor(open)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> Baca di Channel WA Credible Story
                  </a>
                ) : (
                  <span className="text-xs text-ink-muted">Tautan Channel WA belum diatur admin.</span>
                )}
                {open.submission_mode === "link" && (
                  <a className="btn-ghost" href={open.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Buka karya</a>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
