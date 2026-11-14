import { CheckCircle2, Search, Star } from "lucide-react";
import { useState } from "react";
import { PhaseBanner } from "../../components/Rundown";
import { WaActions } from "../../components/WaActions";
import { CopyButton, PageLoader, ProgressBar, Spinner, useToast } from "../../components/ui";
import { fmtDate, fmtDateTime, monthLabel, phaseById, quotaOf, taqdimInfo, todayJakarta } from "../../lib/rundown";
import { errMsg } from "../../lib/supabase";
import type { Member, RundownPeriod } from "../../lib/types";
import { reminderMessage } from "../../lib/wa";
import { logReminder, upsertFlag, useAdminData } from "./data";

/**
 * Taqdim konsep dilakukan via WhatsApp — admin mencatat berapa konsep yang sudah ditaqdimkan (0–target).
 * PIC Special Edition bulan itu otomatis mendapat +2 per Special Edition.
 */
export default function TaqdimChecklist({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "pending" | "done">("all");

  if (loading || !data) return <PageLoader />;
  if (!period) return <p className="text-sm text-ink-muted">Pilih periode rundown.</p>;
  const quota = quotaOf(period);
  const flagOf = (id: string) => data.flags.find((f) => f.member_id === id);
  const specialsOf = (id: string) => data.specials.filter((sp) => sp.pic_member_id === id);
  const info = (id: string) => taqdimInfo(flagOf(id), specialsOf(id).length, quota);

  const all = data.members.filter((m) => m.is_active && m.role === "member");
  const doneCount = all.filter((m) => info(m.id).done).length;
  const notYet = all.filter((m) => !info(m.id).done);
  const conceptsIn = all.reduce((s, m) => s + Math.min(info(m.id).total, quota), 0);
  const shown = all
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => view === "all" || (view === "done" ? info(m.id).done : !info(m.id).done));

  const setCount = async (m: Member, n: number) => {
    setBusy(m.id);
    try {
      await upsertFlag(m.id, pm, { taqdim_count: n });
      reload();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  };
  const reasonFor = (m: Member) => {
    const i = info(m.id);
    return i.total === 0 ? "Belum taqdim konsep" : `Baru taqdim ${i.total}/${quota} konsep${i.bonus ? ` (termasuk +${i.bonus} Special Edition)` : ""}`;
  };
  const phase = phaseById(period, todayJakarta() >= period.w1_end ? "w1_rev" : "w1");
  const groupText = `📋 *Taqdim Konsep — ${monthLabel(pm)}*\nBatas taqdim: *${fmtDate(period.w1_end, true)}* · ${quota} konsep/orang\n\n✅ Sudah lengkap: ${doneCount}/${all.length}\n\n⏳ *Belum lengkap:*\n${notYet.map((m, i) => `${i + 1}. ${m.name} — ${info(m.id).total}/${quota}`).join("\n") || "— semua sudah 🎉"}\n\n_🌟 PIC Special Edition dihitung +2 konsep._\nYang belum, yuk segera kirim taqdim konsepnya ke admin ya 🙏`;

  return (
    <div className="space-y-5">
      <PhaseBanner period={period} compact />

      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Taqdim konsep · {monthLabel(pm)}</p>
            <p className="font-display text-3xl font-extrabold text-ink">{doneCount}/{all.length} <span className="text-base font-semibold text-ink-muted">anggota lengkap</span></p>
            <p className="text-sm text-ink-muted">
              Taqdim via WhatsApp (batas {fmtDate(period.w1_end, true)}). Isi jumlah konsep yang sudah ditaqdimkan tiap anggota — target <b className="text-ink">{quota}</b>.
              PIC Special Edition otomatis <b className="text-ink">+2</b> per special.
            </p>
          </div>
          <CopyButton text={groupText} label="Salin daftar belum lengkap" className="btn-ghost" />
        </div>
        <div className="mt-4"><ProgressBar value={conceptsIn} max={Math.max(all.length * quota, 1)} /></div>
        <p className="mt-1.5 text-xs text-ink-muted">{conceptsIn} dari {all.length * quota} konsep sudah ditaqdimkan</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" type="search" placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {([["all", `Semua (${all.length})`], ["pending", `Belum lengkap (${notYet.length})`], ["done", `Lengkap (${doneCount})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${view === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {(["Ikhwan", "Akhwat"] as const).map((cat) => {
          const list = shown.filter((m) => m.category === cat).sort((a, b) => Number(info(a.id).done) - Number(info(b.id).done) || info(a.id).total - info(b.id).total || a.name.localeCompare(b.name, "id"));
          const d = all.filter((m) => m.category === cat && info(m.id).done).length;
          const tot = all.filter((m) => m.category === cat).length;
          return (
            <section key={cat} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="font-display font-bold text-ink">{cat}</p>
                <span className="text-xs font-semibold text-ink-muted">{d}/{tot} lengkap</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((m) => {
                  const f = flagOf(m.id);
                  const i = info(m.id);
                  const sps = specialsOf(m.id);
                  const maxRegular = Math.max(quota - i.bonus, 0);
                  return (
                    <li key={m.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            {i.done && <CheckCircle2 className="h-4 w-4 shrink-0 fill-emerald-500 text-white" />}
                            <span className="truncate">{m.name}</span>
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {i.done ? `Lengkap${f?.taqdim_marked_at ? ` · ${fmtDateTime(f.taqdim_marked_at)}` : ""}` : f?.last_reminded_at ? `Diingatkan ${f.reminder_count}× (terakhir ${fmtDateTime(f.last_reminded_at)})` : i.total ? "Belum lengkap" : "Belum taqdim"}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2 py-1 font-display text-sm font-extrabold ${i.done ? "bg-emerald-50 text-emerald-700" : i.total ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-ink-muted"}`}>
                          {i.total}/{quota}
                        </span>
                      </div>

                      {sps.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sps.map((sp) => (
                            <span key={sp.id} className="badge border-amber-300 bg-amber-50 text-amber-900" title={`Upload ${fmtDate(sp.publish_date, true)}`}>
                              <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> PIC Special: {sp.title} · +2
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1" role="group" aria-label={`Jumlah konsep ${m.name}`}>
                          <span className="mr-1 text-[11px] font-semibold text-ink-muted">{sps.length ? "Konsep reguler" : "Konsep"}</span>
                          {Array.from({ length: quota + 1 }, (_, n) => n).map((n) => {
                            const on = i.count === n;
                            const over = n > maxRegular && n !== 0;
                            return (
                              <button key={n} disabled={busy === m.id} onClick={() => !on && setCount(m, n)}
                                title={over ? "Melebihi target bila dijumlah dengan Special Edition" : `${n} konsep`}
                                className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold transition ${on ? "bg-ink text-white" : over ? "bg-white text-slate-300 ring-1 ring-slate-200 hover:text-ink-muted" : "bg-white text-ink-body ring-1 ring-slate-200 hover:ring-slate-400"}`}>
                                {busy === m.id && on ? <Spinner className="h-3.5 w-3.5" /> : n}
                              </button>
                            );
                          })}
                        </div>
                        {!i.done && (
                          <WaActions phone={data.phones[m.id]} message={reminderMessage(phase, m.name, period, reasonFor(m))} label="Ingatkan" variant="soft" copyLabel="Salin"
                            hideLabelOnMobile onUse={async () => { await logReminder(m.id, pm, f); reload(); }} />
                        )}
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">Tidak ada anggota.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
