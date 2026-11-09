import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConceptBadge, Empty, Modal, PageLoader, Spinner, useToast } from "../../components/ui";
import { fmtDateTime, quotaOf } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { Concept, RundownPeriod } from "../../lib/types";
import { useAdminData } from "./data";

export default function ConceptReview({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const [filter, setFilter] = useState<"pending" | "revision" | "acc" | "all">("pending");
  const [revise, setRevise] = useState<Concept | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (loading || !data) return <PageLoader />;
  const nameOf = (id: string) => data.members.find((m) => m.id === id);
  const list = data.concepts
    .filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => (nameOf(a.member_id)?.name ?? "").localeCompare(nameOf(b.member_id)?.name ?? "") || a.story_number - b.story_number);
  const counts = { pending: 0, revision: 0, acc: 0 } as Record<string, number>;
  data.concepts.forEach((c) => counts[c.status]++);
  const q = quotaOf(period);
  const notYet = data.members.filter((m) => m.is_active && m.role === "member" && data.concepts.filter((c) => c.member_id === m.id).length < q);

  const acc = async (c: Concept) => {
    setBusy(c.id);
    const { error } = await supabase.from("concept_submissions").update({ status: "acc", reviewer_feedback: null }).eq("id", c.id);
    setBusy(null);
    if (error) toast(errMsg(error), "err"); else { toast("Konsep di-ACC"); reload(); }
  };
  const accAll = async () => {
    const ids = data.concepts.filter((c) => c.status === "pending").map((c) => c.id);
    if (!ids.length || !confirm(`ACC semua ${ids.length} konsep yang menunggu?`)) return;
    const { error } = await supabase.from("concept_submissions").update({ status: "acc" }).in("id", ids);
    if (error) toast(errMsg(error), "err"); else { toast(`${ids.length} konsep di-ACC`); reload(); }
  };
  const sendRevision = async () => {
    if (!revise) return;
    if (note.trim().length < 5) return toast("Tulis catatan feedback untuk member", "err");
    setBusy(revise.id);
    const { error } = await supabase.from("concept_submissions").update({ status: "revision", reviewer_feedback: note.trim() }).eq("id", revise.id);
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast("Permintaan revisi terkirim");
    setRevise(null); setNote(""); reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {([["pending", `Menunggu (${counts.pending})`], ["revision", `Revisi (${counts.revision})`], ["acc", `ACC (${counts.acc})`], ["all", "Semua"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${filter === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
          ))}
        </div>
        {counts.pending > 0 && <button className="btn-ghost" onClick={accAll}><Check className="h-4 w-4" /> ACC semua yang menunggu</button>}
      </div>

      {list.length === 0 ? <Empty title="Tidak ada konsep pada filter ini" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const m = nameOf(c.member_id);
            return (
              <div key={c.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{m?.name} · {m?.category} · Story {c.story_number}</p>
                    <p className="mt-1 font-display text-base font-bold text-ink">{c.title}</p>
                  </div>
                  <ConceptBadge c={c} />
                </div>
                <p className="mt-2 text-sm text-ink-body">{c.summary}</p>
                {c.visual_points && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted"><b>Visual:</b> {c.visual_points}</p>}
                {c.reviewer_feedback && <p className="mt-2 text-xs text-crimson-800">Feedback: {c.reviewer_feedback}</p>}
                <p className="mt-2 text-[11px] text-ink-muted">Diperbarui {fmtDateTime(c.updated_at)}</p>
                <div className="mt-auto flex gap-2 pt-4">
                  {c.status !== "acc" && <button className="btn-primary btn-sm flex-1" disabled={busy === c.id} onClick={() => acc(c)}>{busy === c.id ? <Spinner /> : <Check className="h-3.5 w-3.5" />} ACC Konsep</button>}
                  <button className="btn-ghost btn-sm flex-1" onClick={() => { setRevise(c); setNote(c.reviewer_feedback ?? ""); }}><RotateCcw className="h-3.5 w-3.5" /> Minta Revisi Angle/Ganti Topik</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {notYet.length > 0 && (
        <div className="card p-5">
          <p className="label">Belum lengkap mengajukan {q} konsep ({notYet.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {notYet.map((m) => <span key={m.id} className="badge-slate">{m.name} · {data.concepts.filter((c) => c.member_id === m.id).length}/{q}</span>)}
          </div>
        </div>
      )}

      <Modal open={!!revise} onClose={() => setRevise(null)} title="Minta Revisi Angle / Ganti Topik"
        footer={<><button className="btn-ghost" onClick={() => setRevise(null)}>Batal</button><button className="btn-primary" onClick={sendRevision} disabled={!!busy}>{busy && <Spinner />} Kirim catatan</button></>}>
        <p className="mb-3 text-sm text-ink-muted">“{revise?.title}” — catatan ini tampil di halaman Taqdim member.</p>
        <textarea className="input min-h-[120px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Topik ini sudah pernah terbit di Juli. Coba angle baru: …" autoFocus />
      </Modal>
    </div>
  );
}
