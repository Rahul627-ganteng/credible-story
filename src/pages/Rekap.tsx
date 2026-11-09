import { MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { CopyButton, PageLoader, SectionTitle } from "../components/ui";
import { activePeriodOf, must, useLive, usePeriods } from "../lib/hooks";
import { emojiFor, monthLabel, quotaOf } from "../lib/rundown";
import { supabase } from "../lib/supabase";
import type { Member, PeriodFlag, Story } from "../lib/types";
import { buildRecap } from "../lib/wa";

export default function Rekap() {
  const { isAdmin } = useAuth();
  const { data: periods, loading: lp } = usePeriods();
  const [pm, setPm] = useState("");
  useEffect(() => { if (!pm && periods?.length) setPm(activePeriodOf(periods)!.period_month); }, [periods, pm]);
  const period = periods?.find((p) => p.period_month === pm) ?? null;

  const { data, loading } = useLive(async () => {
    if (!pm) return null;
    const [m, s, f, st] = await Promise.all([
      supabase.from("members").select("id,name,category,role,is_active").eq("is_active", true).eq("role", "member"),
      supabase.from("story_submissions").select("member_id,qc_status,story_target").eq("period_month", pm).eq("is_archive", false),
      isAdmin ? supabase.from("member_period_flags").select("*").eq("period_month", pm) : Promise.resolve({ data: [], error: null }),
      isAdmin ? supabase.from("app_settings").select("key,value").eq("key", "recap_footer") : Promise.resolve({ data: [], error: null }),
    ]);
    return {
      members: must(m) as Pick<Member, "id" | "name" | "category">[],
      stories: must(s) as Pick<Story, "member_id" | "qc_status" | "story_target">[],
      flags: must(f) as PeriodFlag[],
      footer: ((must(st) as { value: string }[])[0]?.value) ?? "",
    };
  }, [pm, isAdmin], ["story_submissions", "members", "member_period_flags"]);

  const [onlyAcc, setOnlyAcc] = useState(false);
  const [warn, setWarn] = useState(true);
  const [footerOn, setFooterOn] = useState(true);
  const [emoji, setEmoji] = useState("");
  useEffect(() => { if (pm) setEmoji(emojiFor(pm, period)); }, [pm, period]);

  const text = useMemo(() => {
    if (!data || !pm) return "";
    const rows = data.members.map((m) => ({
      member: m,
      count: data.stories.filter((s) => s.member_id === m.id && (!onlyAcc || s.qc_status === "acc")).length,
      excuse: data.flags.find((f) => f.member_id === m.id)?.excuse_note ?? null,
    }));
    return buildRecap({ periodMonth: pm, emoji: emoji || "✨", rows, footer: footerOn ? data.footer : "", showZeroWarning: warn, onlyAcc, quota: quotaOf(period) });
  }, [data, pm, onlyAcc, warn, emoji, footerOn, period]);

  if (lp) return <PageLoader />;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Generator" title="Rekap Teks WhatsApp" desc="Teks rekap dibaca langsung dari daftar anggota aktif dan setoran bulan terpilih — siap salin ke grup WA."
        action={
          <select className="input w-auto" value={pm} onChange={(e) => setPm(e.target.value)} aria-label="Periode">
            {(periods ?? []).map((p) => <option key={p.id} value={p.period_month}>{p.emoji} {monthLabel(p.period_month)}</option>)}
          </select>
        } />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="card h-fit space-y-4 p-5">
          <label className="block"><span className="label">Emoji bulan</span>
            <input className="input text-center text-xl" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={onlyAcc} onChange={(e) => setOnlyAcc(e.target.checked)} /> Hitung yang lolos QC saja</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={warn} onChange={(e) => setWarn(e.target.checked)} /> Peringatan 0 setoran</label>
          {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={footerOn} onChange={(e) => setFooterOn(e.target.checked)} /> Kalimat penutup</label>}
          {data && (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-ink-muted">
              <p><b className="text-ink">{data.members.length}</b> anggota aktif</p>
              <p><b className="text-ink">{data.stories.length}</b> setoran ({data.stories.filter((s) => s.qc_status === "acc").length} lolos QC)</p>
            </div>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><MessageSquareText className="h-4 w-4 text-crimson-600" /> Pratinjau</p>
            <CopyButton text={text} label="Salin rekap" className="btn-primary btn-sm" />
          </div>
          {loading ? <PageLoader /> : <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap bg-[#F0FDF4]/40 p-5 font-mono text-[13px] leading-relaxed text-ink scrollbar-thin">{text}</pre>}
        </div>
      </div>
    </div>
  );
}
