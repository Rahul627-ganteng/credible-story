import { CheckCircle2, Circle, MessageCircle, Search } from "lucide-react";
import { useState } from "react";
import { PhaseBanner } from "../../components/Rundown";
import { CopyButton, PageLoader, ProgressBar, Spinner, useToast } from "../../components/ui";
import { fmtDate, fmtDateTime, monthLabel, phaseById, quotaOf, todayJakarta } from "../../lib/rundown";
import { errMsg } from "../../lib/supabase";
import type { Member, RundownPeriod } from "../../lib/types";
import { reminderMessage, waLink } from "../../lib/wa";
import { logReminder, upsertFlag, useAdminData } from "./data";

/** Taqdim konsep dilakukan via WhatsApp — di sini admin cukup menandai siapa yang sudah taqdim. */
export default function TaqdimChecklist({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (loading || !data) return <PageLoader />;
  if (!period) return <p className="text-sm text-ink-muted">Pilih periode rundown.</p>;
  const flagOf = (id: string) => data.flags.find((f) => f.member_id === id);
  const done = (id: string) => !!flagOf(id)?.taqdim_done;
  const active = data.members.filter((m) => m.is_active && m.role === "member" && (!q || m.name.toLowerCase().includes(q.toLowerCase())));
  const all = data.members.filter((m) => m.is_active && m.role === "member");
  const doneCount = all.filter((m) => done(m.id)).length;
  const notYet = all.filter((m) => !done(m.id));
  const quota = quotaOf(period);

  const toggle = async (m: Member) => {
    setBusy(m.id);
    try {
      const next = !done(m.id);
      await upsertFlag(m.id, pm, { taqdim_done: next, taqdim_marked_at: next ? new Date().toISOString() : null });
      reload();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  };
  const remind = async (m: Member) => {
    const ph = phaseById(period, todayJakarta() >= period.w1_end ? "w1_rev" : "w1");
    const link = waLink(data.phones[m.id], reminderMessage(ph, m.name, period, "Belum taqdim konsep"));
    if (!link) return toast(`Nomor WA ${m.name} belum diisi (ubah di tab Member)`, "err");
    window.open(link, "_blank");
    await logReminder(m.id, pm, flagOf(m.id));
  };
  const groupText = `📋 *Taqdim Konsep — ${monthLabel(pm)}*\nBatas taqdim: *${fmtDate(period.w1_end, true)}* · ${quota} konsep/orang\n\n✅ Sudah taqdim: ${doneCount}/${all.length}\n\n⏳ *Belum taqdim:*\n${notYet.map((m, i) => `${i + 1}. ${m.name}`).join("\n") || "— semua sudah 🎉"}\n\nYang belum, yuk segera kirim taqdim konsepnya ke admin ya 🙏`;

  return (
    <div className="space-y-5">
      <PhaseBanner period={period} compact />

      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Taqdim konsep · {monthLabel(pm)}</p>
            <p className="font-display text-3xl font-extrabold text-ink">{doneCount}/{all.length} <span className="text-base font-semibold text-ink-muted">sudah taqdim</span></p>
            <p className="text-sm text-ink-muted">Taqdim dilakukan via WhatsApp (batas {fmtDate(period.w1_end, true)}). Tandai member yang sudah mengirim.</p>
          </div>
          <CopyButton text={groupText} label="Salin daftar belum taqdim" className="btn-ghost" />
        </div>
        <div className="mt-4"><ProgressBar value={doneCount} max={Math.max(all.length, 1)} /></div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" type="search" placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {(["Ikhwan", "Akhwat"] as const).map((cat) => {
          const list = active.filter((m) => m.category === cat).sort((a, b) => Number(done(a.id)) - Number(done(b.id)) || a.name.localeCompare(b.name, "id"));
          const d = list.filter((m) => done(m.id)).length;
          return (
            <section key={cat} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="font-display font-bold text-ink">{cat}</p>
                <span className="text-xs font-semibold text-ink-muted">{d}/{list.length} sudah</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((m) => {
                  const f = flagOf(m.id);
                  const ok = done(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <button onClick={() => toggle(m)} disabled={busy === m.id} aria-pressed={ok}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition ${ok ? "" : "hover:bg-slate-50"}`}>
                        {busy === m.id ? <Spinner className="h-6 w-6" /> : ok
                          ? <CheckCircle2 className="h-6 w-6 shrink-0 fill-emerald-500 text-white" />
                          : <Circle className="h-6 w-6 shrink-0 text-slate-300" />}
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-semibold ${ok ? "text-ink" : "text-ink-body"}`}>{m.name}</span>
                          <span className="block truncate text-[11px] text-ink-muted">
                            {ok ? `Sudah taqdim${f?.taqdim_marked_at ? ` · ditandai ${fmtDateTime(f.taqdim_marked_at)}` : ""}` : f?.last_reminded_at ? `Belum · diingatkan ${f.reminder_count}× (terakhir ${fmtDateTime(f.last_reminded_at)})` : "Belum taqdim"}
                          </span>
                        </span>
                      </button>
                      {!ok && (
                        <button className="btn-soft btn-sm shrink-0" onClick={() => remind(m)} disabled={!data.phones[m.id]} title={data.phones[m.id] ? "Kirim pengingat taqdim via WA" : "Nomor WA belum diisi"}>
                          <MessageCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ingatkan</span>
                        </button>
                      )}
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
