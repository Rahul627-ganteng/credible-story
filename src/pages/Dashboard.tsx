import { ArrowRight, BookOpen, ClipboardList, FolderOpen, NotebookPen, Phone, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PhaseBanner } from "../components/Rundown";
import { ConceptBadge, Markdown, PageLoader, ProgressBar, QcBadge, Spinner, useToast } from "../components/ui";
import { activePeriodOf, must, useLive, usePeriods } from "../lib/hooks";
import { fmtDateTime, monthLabel, phaseOf, progressEmoji } from "../lib/rundown";
import { errMsg, supabase } from "../lib/supabase";
import type { Concept, LearningMaterial, Story } from "../lib/types";
import { normalizePhone } from "../lib/wa";

export default function Dashboard() {
  const { member, isAdmin } = useAuth();
  const { data: periods, loading: lp } = usePeriods();
  const period = activePeriodOf(periods);
  const pm = period?.period_month ?? "";
  const lastEval = periods?.find((p) => p.monthly_evaluation_notes && p.evaluation_published_at);

  const { data, loading } = useLive(async () => {
    if (!member || !pm) return { concepts: [] as Concept[], stories: [] as Story[], materials: [] as LearningMaterial[] };
    const [c, s, m] = await Promise.all([
      supabase.from("concept_submissions").select("*").eq("member_id", member.id).eq("period_month", pm),
      supabase.from("story_submissions").select("*").eq("member_id", member.id).eq("period_month", pm).eq("is_archive", false),
      supabase.from("learning_materials").select("id,title,design_app,difficulty_level,batch_date").order("created_at", { ascending: false }).limit(3),
    ]);
    return { concepts: must(c) as Concept[], stories: must(s) as Story[], materials: must(m) as LearningMaterial[] };
  }, [member?.id, pm], ["concept_submissions", "story_submissions", "learning_materials"]);

  if (lp || loading || !member) return <PageLoader />;
  const concepts = data?.concepts ?? [];
  const stories = data?.stories ?? [];
  const done = stories.length;
  const ph = phaseOf(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Assalamu'alaikum</p>
          <h1 className="text-3xl font-extrabold">{member.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{isAdmin ? "Super Admin" : member.category} · <span className="font-mono">@{member.username}</span></p>
        </div>
        {isAdmin && <Link to="/admin" className="btn-dark">Buka Admin Center <ArrowRight className="h-4 w-4" /></Link>}
      </div>

      <PhaseBanner period={period} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Progres {period ? monthLabel(pm) : ""}</p>
              <p className="font-display text-4xl font-extrabold text-ink">{done}/3 <span className="text-3xl">{progressEmoji(done)}</span></p>
              <p className="text-sm text-ink-muted">{done >= 3 ? "MasyaAllah, target bulan ini tuntas!" : `${3 - done} story lagi menuju target bulan ini.`}</p>
            </div>
            {member.folder_url && (
              <a href={member.folder_url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><FolderOpen className="h-4 w-4" /> Folder Drive</a>
            )}
          </div>
          <div className="mt-4"><ProgressBar value={done} /></div>
          <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {[1, 2, 3].map((n) => {
              const c = concepts.find((x) => x.story_number === n);
              const s = stories.find((x) => x.story_target === n);
              return (
                <div key={n} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Story {n}</p>
                    <p className="truncate font-medium text-ink">{c?.title ?? <span className="text-ink-muted">Konsep belum diajukan</span>}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5"><ConceptBadge c={c} /><QcBadge s={s} /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/taqdim" className={ph.week === 1 ? "btn-primary" : "btn-ghost"}><ClipboardList className="h-4 w-4" /> Taqdim Konsep</Link>
            <Link to="/app/setoran" className={ph.week >= 2 && ph.week <= 4 ? "btn-primary" : "btn-ghost"}><Upload className="h-4 w-4" /> Setor Story</Link>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <p className="label flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Materi terbaru</p>
            <ul className="mt-2 space-y-2.5">
              {(data?.materials ?? []).map((m) => (
                <li key={m.id}>
                  <Link to="/app/belajar" className="group block">
                    <p className="text-sm font-semibold text-ink group-hover:text-crimson-700">{m.title}</p>
                    <p className="text-xs text-ink-muted">{m.design_app} · {m.difficulty_level}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/app/belajar" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-crimson-700">Buka Learning Hub <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <MyPhone />
        </div>
      </div>

      {lastEval && (
        <div className="card border-l-4 border-l-crimson-600 p-5">
          <p className="eyebrow flex items-center gap-1.5"><NotebookPen className="h-3.5 w-3.5" /> Evaluasi Bulanan · {lastEval.emoji} {monthLabel(lastEval.period_month)}</p>
          <div className="mt-2"><Markdown>{lastEval.monthly_evaluation_notes!}</Markdown></div>
          <p className="mt-2 text-xs text-ink-muted">Dipublikasikan {fmtDateTime(lastEval.evaluation_published_at)}</p>
        </div>
      )}
    </div>
  );
}

function MyPhone() {
  const { member } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!member) return;
    supabase.from("member_contacts").select("phone_number").eq("member_id", member.id).maybeSingle()
      .then(({ data }) => { setPhone(data?.phone_number ?? ""); setLoaded(true); });
  }, [member]);
  const save = async () => {
    const n = normalizePhone(phone);
    if (!n) return toast("Nomor WhatsApp tidak valid", "err");
    setBusy(true);
    const { error } = await supabase.from("member_contacts").update({ phone_number: n, updated_at: new Date().toISOString() }).eq("member_id", member!.id);
    setBusy(false);
    if (error) toast(errMsg(error), "err");
    else { setPhone(n); toast("Nomor WhatsApp tersimpan"); }
  };
  return (
    <div className="card p-5">
      <p className="label flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Nomor WhatsApp kamu</p>
      <p className="mb-2 text-xs text-ink-muted">Dipakai admin untuk pengingat rundown. Hanya terlihat oleh kamu & admin.</p>
      <div className="flex gap-2">
        <input className="input font-mono" placeholder={loaded ? "0812…" : "Memuat…"} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-dark" onClick={save} disabled={busy}>{busy ? <Spinner /> : "Simpan"}</button>
      </div>
    </div>
  );
}
