import { CalendarClock } from "lucide-react";
import { deadlinesOf, fmtDate, phaseOf, quotaOf, type PhaseInfo } from "../lib/rundown";
import type { RundownPeriod } from "../lib/types";

const toneCls: Record<PhaseInfo["tone"], string> = {
  green: "from-emerald-500/15", blue: "from-sky-500/15", red: "from-crimson-500/15", amber: "from-amber-500/20", slate: "from-slate-400/15",
};
const DOTS = ["🔵", "🔴", "🟠", "🟣", "🔵", "🔴"];

export function PhaseBanner({ period, compact = false }: { period: RundownPeriod | null; compact?: boolean }) {
  const ph = phaseOf(period);
  const q = quotaOf(period);
  const dls = deadlinesOf(period);
  const steps = period ? [
    { step: 1, label: `Taqdim ${q} konsep`, dot: "🟢", range: `${fmtDate(period.w1_start)} – ${fmtDate(period.w1_end)}` },
    ...dls.map((d, i) => ({ step: 2 + i, label: `Story ${i + 1} + QC`, dot: DOTS[i % DOTS.length], range: `tenggat ${fmtDate(d)}` })),
  ] : [];
  return (
    <div className={`card relative overflow-hidden bg-gradient-to-br ${toneCls[ph.tone]} to-white p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {period ? `${period.emoji} ${period.label ?? period.period_month} · target ${q} story` : "Rundown"}</p>
          <h2 className="mt-1 text-xl font-extrabold">{ph.title}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{ph.subtitle}</p>
        </div>
        {ph.daysLeft != null && ph.key !== "pre" && (
          <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-display text-2xl font-extrabold text-crimson-700">{Math.max(ph.daysLeft, 0)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{ph.daysLeft === 0 ? "hari terakhir" : "hari lagi"}</p>
          </div>
        )}
      </div>
      {!compact && period && (
        <div className={`mt-5 grid grid-cols-2 gap-2 ${steps.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {steps.map((w) => {
            const cur = ph.key === "sks" ? w.step === 1 + q : ph.step === w.step;
            const past = ph.step > w.step && !(ph.key === "sks" && w.step === 1 + q);
            return (
              <div key={w.step} className={`rounded-xl border px-3 py-2.5 text-xs transition ${cur ? "border-crimson-300 bg-white shadow-sm ring-2 ring-crimson-500/15" : past ? "border-slate-200 bg-white/50 text-ink-muted" : "border-slate-200 bg-white/70"}`}>
                <p className="font-semibold text-ink">{w.dot} {w.label}{past && " ✓"}</p>
                <p className="mt-1 font-mono text-[11px] text-ink-muted">{w.range}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
