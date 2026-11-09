import { Lock, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { PhaseBanner } from "../components/Rundown";
import { ConceptBadge, Field, PageLoader, SectionTitle, Spinner, useToast } from "../components/ui";
import { activePeriodOf, must, useLive, usePeriods } from "../lib/hooks";
import { monthLabel } from "../lib/rundown";
import { errMsg, supabase } from "../lib/supabase";
import type { Concept, RundownPeriod } from "../lib/types";

export default function Taqdim() {
  const { member } = useAuth();
  const { data: periods, loading: lp } = usePeriods();
  const [pm, setPm] = useState("");
  useEffect(() => { if (!pm && periods?.length) setPm(activePeriodOf(periods)!.period_month); }, [periods, pm]);
  const period = periods?.find((p) => p.period_month === pm) ?? null;

  const { data: concepts, loading } = useLive(async () => {
    if (!member || !pm) return [] as Concept[];
    return must(await supabase.from("concept_submissions").select("*").eq("member_id", member.id).eq("period_month", pm).order("story_number")) as Concept[];
  }, [member?.id, pm], ["concept_submissions"]);

  if (lp || !member) return <PageLoader />;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Minggu 1 · Hari 1–7"
        title="Taqdim 3 Konsep Story"
        desc="Ajukan judul, ringkasan materi, dan poin utama visual untuk 3 story bulan ini. Admin akan memberi ACC atau catatan revisi."
        action={
          <select className="input w-auto" value={pm} onChange={(e) => setPm(e.target.value)} aria-label="Periode">
            {(periods ?? []).map((p) => <option key={p.id} value={p.period_month}>{p.emoji} {monthLabel(p.period_month)}{p.is_locked ? " (terkunci)" : ""}</option>)}
          </select>
        }
      />
      <PhaseBanner period={period} compact />
      {loading ? <PageLoader /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <ConceptCard key={`${pm}-${n}`} n={n as 1 | 2 | 3} period={period} memberId={member.id} concept={concepts?.find((c) => c.story_number === n) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ n, period, memberId, concept }: { n: 1 | 2 | 3; period: RundownPeriod | null; memberId: string; concept: Concept | null }) {
  const toast = useToast();
  const [title, setTitle] = useState(concept?.title ?? "");
  const [summary, setSummary] = useState(concept?.summary ?? "");
  const [visual, setVisual] = useState(concept?.visual_points ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitle(concept?.title ?? ""); setSummary(concept?.summary ?? ""); setVisual(concept?.visual_points ?? "");
  }, [concept?.id, concept?.updated_at]);

  const locked = !period || period.is_locked || concept?.status === "acc";
  const dirty = title !== (concept?.title ?? "") || summary !== (concept?.summary ?? "") || visual !== (concept?.visual_points ?? "");

  const save = async () => {
    if (!period) return;
    if (title.trim().length < 4 || summary.trim().length < 10) return toast("Judul min. 4 karakter dan ringkasan min. 10 karakter.", "err");
    setBusy(true);
    const { error } = await supabase.from("concept_submissions").upsert({
      member_id: memberId, period_month: period.period_month, story_number: n,
      title: title.trim(), summary: summary.trim(), visual_points: visual.trim() || null,
    }, { onConflict: "member_id,period_month,story_number" });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("Konsep tersimpan & menunggu review admin");
  };

  return (
    <div className={`card flex flex-col p-5 ${concept?.status === "revision" ? "ring-2 ring-crimson-500/30" : ""}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-ink">Konsep {n}</span>
        <ConceptBadge c={concept} />
      </div>
      {concept?.status === "revision" && concept.reviewer_feedback && (
        <div className="mb-3 rounded-xl border border-crimson-200 bg-crimson-50 px-3 py-2 text-sm text-crimson-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Catatan admin</p>
          <p className="mt-0.5">{concept.reviewer_feedback}</p>
        </div>
      )}
      {concept?.status === "acc" && concept.reviewer_feedback && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">💬 {concept.reviewer_feedback}</p>
      )}
      <div className="flex-1 space-y-3">
        <Field label="Judul / Topik">
          <input className="input" disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Mis. Adab Bertanya kepada Guru" />
        </Field>
        <Field label="Ringkasan materi">
          <textarea className="input min-h-[96px]" disabled={locked} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={800} placeholder="Pesan utama yang ingin disampaikan, sumber/dalil bila ada…" />
        </Field>
        <Field label="Poin utama visual">
          <textarea className="input min-h-[72px]" disabled={locked} value={visual} onChange={(e) => setVisual(e.target.value)} maxLength={500} placeholder="Gaya, warna, ikon, layout…" />
        </Field>
      </div>
      <div className="mt-4">
        {locked ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Lock className="h-3.5 w-3.5" /> {concept?.status === "acc" ? "Sudah di-ACC — lanjutkan ke desain." : "Periode terkunci."}</p>
        ) : (
          <button className="btn-primary w-full" onClick={save} disabled={busy || !dirty}>
            {busy ? <Spinner /> : <Save className="h-4 w-4" />} {concept ? (concept.status === "revision" ? "Kirim revisi" : "Perbarui konsep") : "Ajukan konsep"}
          </button>
        )}
      </div>
    </div>
  );
}
