import { Check, ExternalLink, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Empty, Modal, PageLoader, QcBadge, Spinner, useToast } from "../../components/ui";
import { previewUrl } from "../../lib/hooks";
import { fmtDate, fmtDateTime, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod, Story } from "../../lib/types";
import { useAdminData } from "./data";

export default function QcReview({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const [filter, setFilter] = useState<"pending_qc" | "revision" | "acc" | "all">("pending_qc");
  const [open, setOpen] = useState<Story | null>(null);

  if (loading || !data) return <PageLoader />;
  const list = data.stories.filter((s) => filter === "all" || s.qc_status === filter)
    .sort((a, b) => (a.member_name ?? "").localeCompare(b.member_name ?? "") || a.story_target - b.story_target);
  const counts = { pending_qc: 0, revision: 0, acc: 0 } as Record<string, number>;
  data.stories.forEach((s) => counts[s.qc_status]++);

  const togglePublish = async (s: Story) => {
    const { error } = await supabase.from("story_submissions").update({ is_published_to_showcase: !s.is_published_to_showcase }).eq("id", s.id);
    if (error) toast(errMsg(error), "err"); else { toast(s.is_published_to_showcase ? "Disembunyikan dari galeri" : "Tampil di galeri publik"); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
        {([["pending_qc", `Menunggu QC (${counts.pending_qc})`], ["revision", `Revisi (${counts.revision})`], ["acc", `Lolos (${counts.acc})`], ["all", "Semua"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${filter === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? <Empty title="Tidak ada setoran pada filter ini" /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((s) => {
            const src = previewUrl(s.file_url, s.submission_mode);
            return (
              <div key={s.id} className="card overflow-hidden">
                <button className="block w-full bg-slate-100" style={{ aspectRatio: "9/16" }} onClick={() => setOpen(s)}>
                  {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-ink-muted">Tautan eksternal</span>}
                </button>
                <div className="space-y-1.5 p-3">
                  <p className="truncate text-sm font-semibold text-ink">{s.member_name} · S{s.story_target}</p>
                  <p className="line-clamp-1 text-xs text-ink-muted">{s.title}</p>
                  <QcBadge s={s} />
                  {s.is_published_to_showcase && s.published_at && new Date(s.published_at) > new Date() && <span className="badge-amber">Terjadwal {fmtDate(toJakartaDate(s.published_at))}</span>}
                  <div className="flex gap-1.5 pt-1">
                    <button className="btn-ghost btn-sm flex-1" onClick={() => setOpen(s)}>Tinjau</button>
                    {s.qc_status === "acc" && (
                      <button className="btn-ghost btn-sm" onClick={() => togglePublish(s)} title={s.is_published_to_showcase ? "Sembunyikan dari galeri" : "Tampilkan di galeri"}>
                        {s.is_published_to_showcase ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <ReviewModal s={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </div>
  );
}

function ReviewModal({ s, onClose, onDone }: { s: Story; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [notes, setNotes] = useState(s.qc_notes ?? "");
  const [wa, setWa] = useState(s.wa_channel_link ?? "");
  const [publish, setPublish] = useState(s.qc_status === "acc" ? s.is_published_to_showcase : true);
  const [pubDate, setPubDate] = useState(s.published_at ? toJakartaDate(s.published_at) : todayJakarta());
  const [busy, setBusy] = useState(false);
  const src = previewUrl(s.file_url, s.submission_mode);

  const save = async (status: Story["qc_status"]) => {
    if (status === "revision" && notes.trim().length < 5) return toast("Tulis catatan QC untuk revisi", "err");
    if (wa && !/^https:\/\//.test(wa)) return toast("Link Channel WA harus diawali https://", "err");
    setBusy(true);
    const { error } = await supabase.from("story_submissions").update({
      qc_status: status, qc_notes: notes.trim() || null, wa_channel_link: wa.trim() || null,
      is_published_to_showcase: status === "acc" ? publish : false,
      published_at: status === "acc" && publish ? publishInstant(pubDate, s.published_at) : null,
    }).eq("id", s.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    const later = pubDate > todayJakarta();
    toast(status === "acc" ? (publish ? (later ? `Lolos QC — terjadwal tampil ${fmtDate(pubDate, true)} pukul 07.00 WIB` : "Lolos QC & langsung tampil di Galeri") : "Lolos QC") : "Catatan revisi terkirim");
    onDone();
  };

  return (
    <Modal open onClose={onClose} wide title={`${s.member_name} · Story ${s.story_target}`}
      footer={<>
        <button className="btn-ghost" onClick={() => save("revision")} disabled={busy}><RotateCcw className="h-4 w-4" /> Minta revisi</button>
        <button className="btn-primary" onClick={() => save("acc")} disabled={busy}>{busy ? <Spinner /> : <Check className="h-4 w-4" />} ACC{publish ? " & Terbitkan" : ""}</button>
      </>}>
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: "9/16" }}>
          {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-ink-muted">Pratinjau tidak tersedia</div>}
        </div>
        <div className="space-y-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">{s.title}</p>
            <p className="text-xs text-ink-muted">{s.category} · {s.design_app} · disetor {fmtDateTime(s.created_at)}</p>
            <a href={s.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-crimson-700"><ExternalLink className="h-3.5 w-3.5" /> Buka file asli</a>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-ink-muted">
            <p className="font-semibold text-ink">Checklist QC</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4"><li>Sesuai konsep yang di-ACC</li><li>Layout rapi, rasio 9:16, safe area aman</li><li>Bebas typo &amp; dalil/sumber jelas</li></ul>
          </div>
          <label className="block"><span className="label">Catatan QC</span>
            <textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wajib diisi bila meminta revisi" />
          </label>
          <label className="block"><span className="label">Link postingan Channel WA (opsional)</span>
            <input className="input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://whatsapp.com/channel/…" />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Tampilkan di Galeri Kurasi publik</label>
          {publish && (
            <label className="block"><span className="label">Tanggal terbit</span>
              <input type="date" className="input font-mono" value={pubDate} onChange={(e) => setPubDate(e.target.value || todayJakarta())} />
              <span className="mt-1 block text-xs text-ink-muted">
                {pubDate === todayJakarta() ? "Hari ini — langsung tampil di sorotan “Terbit Hari Ini”." : pubDate > todayJakarta() ? `Terjadwal: otomatis tampil ${fmtDate(pubDate, true)} pukul 07.00 WIB.` : "Tanggal lampau — masuk galeri sesuai tanggal tersebut."}
              </span>
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}

function toJakartaDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Hari ini → sekarang; tanggal mendatang → 07.00 WIB; tanggal lampau → 19.00 WIB (tetap pakai waktu lama bila tanggalnya sama) */
function publishInstant(date: string, existing: string | null): string {
  if (existing && toJakartaDate(existing) === date) return existing;
  const today = todayJakarta();
  if (date === today) return new Date().toISOString();
  return new Date(`${date}T${date > today ? "07:00" : "19:00"}:00+07:00`).toISOString();
}
