import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PhaseBanner } from "../../components/Rundown";
import { PageLoader, ProgressBar, Stat } from "../../components/ui";
import { must, useLive } from "../../lib/hooks";
import { pendingReason, phaseOf, progressEmoji, progressFor, quotaOf } from "../../lib/rundown";
import { supabase } from "../../lib/supabase";
import type { RundownPeriod } from "../../lib/types";
import { useAdminData } from "./data";

export default function Overview({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const { data, loading } = useAdminData(pm);
  const { data: pendingApps } = useLive(async () => {
    const r = await supabase.from("recruitment_applications").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (r.error) throw r.error;
    return r.count ?? 0;
  }, [], ["recruitment_applications"]);
  const { data: recentStories } = useLive(async () =>
    must(await supabase.from("story_submissions").select("id,member_name,story_target,special_id,title,qc_status,created_at").eq("is_archive", false).order("created_at", { ascending: false }).limit(6)) as {
      id: string; member_name: string; story_target: number | null; special_id: string | null; title: string; qc_status: string; created_at: string }[],
  [], ["story_submissions"]);

  if (loading || !data) return <PageLoader />;
  const active = data.members.filter((m) => m.is_active && m.role === "member");
  const ph = phaseOf(period);
  const q = quotaOf(period);
  const pending = active.filter((m) => pendingReason(ph, progressFor(m.id, data.concepts, data.stories), q));
  const totalStories = data.stories.filter((s) => !s.special_id).length;
  const conceptsPending = data.concepts.filter((c) => c.status === "pending").length;
  const qcPending = data.stories.filter((s) => s.qc_status === "pending_qc").length;
  const ranking = active.map((m) => ({ m, n: data.stories.filter((s) => s.member_id === m.id && !s.special_id).length })).sort((a, b) => b.n - a.n || a.m.name.localeCompare(b.m.name));
  const target = active.length * q;

  return (
    <div className="space-y-5">
      <PhaseBanner period={period} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Anggota aktif" value={active.length} sub={`${active.filter((m) => m.category === "Ikhwan").length} Ikhwan · ${active.filter((m) => m.category === "Akhwat").length} Akhwat`} />
        <Stat label="Story tersetor" value={`${totalStories}/${target}`} sub={`${target ? Math.round((totalStories / target) * 100) : 0}% dari target tim`} />
        <Stat label="Perlu ditinjau" value={conceptsPending + qcPending} sub={`${conceptsPending} taqdim · ${qcPending} QC`} accent={conceptsPending + qcPending > 0} />
        <Stat label="Belum memenuhi fase" value={pending.length} sub={ph.key === "pre" || ph.key === "done" ? "—" : "lihat Pengingat WA"} accent={pending.length > 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="label">Papan progres anggota</p>
          <div className="mt-2 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {ranking.map(({ m, n }) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm font-medium text-ink">{m.name}</span>
                <div className="flex-1"><ProgressBar value={n} max={q} /></div>
                <span className="w-12 text-right text-xs font-semibold text-ink-muted">{n}/{q} {progressEmoji(n, q)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="card space-y-2 p-5">
            <p className="label">Tindakan cepat</p>
            {[
              ["/admin/taqdim", `Validasi taqdim (${conceptsPending})`],
              ["/admin/qc", `QC setoran (${qcPending})`],
              ["/admin/pendaftar", `Pendaftar baru (${pendingApps ?? 0})`],
              ["/admin/pengingat", `Kirim pengingat (${pending.length})`],
            ].map(([to, l]) => (
              <Link key={to} to={to} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-ink hover:border-crimson-300 hover:text-crimson-700">
                {l} <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
          <div className="card p-5">
            <p className="label">Setoran terbaru</p>
            <ul className="space-y-2">
              {(recentStories ?? []).map((s) => (
                <li key={s.id} className="text-sm">
                  <p className="truncate font-medium text-ink">{s.member_name} · {s.special_id ? "🌟 Special Edition" : `Story ${s.story_target}`}</p>
                  <p className="truncate text-xs text-ink-muted">{s.title}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
