import { ArrowRight, Check, ExternalLink, RotateCcw, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal, PageLoader, Spinner, useToast } from "../../components/ui";
import { previewUrl } from "../../lib/hooks";
import { STAGE_LABEL, pubStage, storyLabel } from "../../lib/publish";
import { fmtDateTime } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod, Story } from "../../lib/types";
import { useAdminData } from "./data";

export default function QcReview({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const { data, loading, reload } = useAdminData(pm);
  const [filter, setFilter] = useState<"pending_qc" | "revision" | "acc" | "all">("pending_qc");
  const [open, setOpen] = useState<Story | null>(null);

  if (loading || !data) return <PageLoader />;
  const list = data.stories.filter((s) => filter === "all" || s.qc_status === filter)
    .sort((a, b) => (a.member_name ?? "").localeCompare(b.member_name ?? "") || (a.story_target ?? 99) - (b.story_target ?? 99));
  const counts = { pending_qc: 0, revision: 0, acc: 0 } as Record<string, number>;
  data.stories.forEach((s) => counts[s.qc_status]++);
  const waiting = data.stories.filter((s) => ["need_final", "watermarked"].includes(pubStage(s))).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-1 flex overflow-x-auto px-1 scrollbar-thin">
          <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 text-sm">
            {([["pending_qc", `Menunggu QC (${counts.pending_qc})`], ["revision", `Revisi (${counts.revision})`], ["acc", `ACC (${counts.acc})`], ["all", "Semua"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold ${filter === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        {waiting > 0 && (
          <Link to="/admin/publikasi" className="btn-soft btn-sm">{waiting} ACC menunggu watermark <ArrowRight className="h-3.5 w-3.5" /></Link>
        )}
      </div>
      <p className="text-xs text-ink-muted">Story yang di-ACC <b>tidak langsung tampil di galeri</b>. Unduh batch-nya, beri watermark, lalu terbitkan lewat tab <Link to="/admin/publikasi" className="font-semibold text-crimson-700">Batch &amp; Publikasi</Link>.</p>
      {list.length === 0 ? <Empty title="Tidak ada setoran pada filter ini" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {list.map((s) => {
            const src = previewUrl(s.file_url, s.submission_mode);
            const st = STAGE_LABEL[pubStage(s)];
            return (
              <button key={s.id} className="card overflow-hidden text-left" onClick={() => setOpen(s)}>
                <div className="relative block w-full bg-slate-100" style={{ aspectRatio: "9/16" }}>
                  {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-ink-muted">Tautan eksternal</span>}
                  {s.special_id && <span className="badge absolute left-2 top-2 border-amber-300 bg-amber-100 text-amber-900"><Star className="h-3 w-3" /> Special</span>}
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="truncate text-sm font-semibold text-ink">{s.member_name} · {storyLabel(s, true)}</p>
                  <p className="line-clamp-1 text-xs text-ink-muted">{s.title}</p>
                  <span className={st.cls}>{st.text}</span>
                </div>
              </button>
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
  const [busy, setBusy] = useState(false);
  const src = previewUrl(s.file_url, s.submission_mode);
  const published = s.is_published_to_showcase;

  const save = async (status: Story["qc_status"]) => {
    if (status === "revision" && notes.trim().length < 5) return toast("Tulis catatan QC untuk revisi", "err");
    if (status === "revision" && published && !confirm("Story ini sudah terbit di galeri. Minta revisi akan menurunkannya dari galeri. Lanjutkan?")) return;
    setBusy(true);
    const { error } = await supabase.from("story_submissions").update({ qc_status: status, qc_notes: notes.trim() || null }).eq("id", s.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast(status === "acc" ? "ACC — masuk antrean batch watermark" : "Catatan revisi terkirim ke member");
    onDone();
  };

  return (
    <Modal open onClose={onClose} wide title={`${s.member_name} · ${storyLabel(s)}`}
      footer={<>
        <button className="btn-ghost" onClick={() => save("revision")} disabled={busy}><RotateCcw className="h-4 w-4" /> Minta revisi</button>
        <button className="btn-primary" onClick={() => save("acc")} disabled={busy || s.qc_status === "acc"}>{busy ? <Spinner /> : <Check className="h-4 w-4" />} {s.qc_status === "acc" ? "Sudah ACC" : "ACC"}</button>
      </>}>
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: "9/16" }}>
          {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-ink-muted">Pratinjau tidak tersedia</div>}
        </div>
        <div className="space-y-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">{s.title}</p>
            <p className="text-xs text-ink-muted">{s.category} · {s.design_app ?? "aplikasi ?"} · disetor {fmtDateTime(s.created_at)}</p>
            <a href={s.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-crimson-700"><ExternalLink className="h-3.5 w-3.5" /> Buka file asli</a>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-ink-muted">
            <p className="font-semibold text-ink">Checklist QC</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>{s.special_id ? "Sesuai tema Special Edition" : "Sesuai konsep yang di-ACC"}</li>
              <li>Layout rapi, rasio 9:16, safe area aman</li>
              <li>Bebas typo &amp; dalil/sumber jelas</li>
            </ul>
          </div>
          <label className="block"><span className="label">Catatan QC</span>
            <textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wajib diisi bila meminta revisi" />
          </label>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Setelah ACC, story masuk antrean <b>Batch &amp; Publikasi</b>: unduh batch, beri watermark di Photoshop, unggah hasilnya, lalu terbitkan.
          </p>
        </div>
      </div>
    </Modal>
  );
}
