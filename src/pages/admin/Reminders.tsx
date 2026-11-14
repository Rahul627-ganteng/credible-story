import { AlertTriangle, CheckCircle2, Ghost, Send, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { PhaseBanner } from "../../components/Rundown";
import { CopyButton, Empty, PageLoader, Spinner, useToast } from "../../components/ui";
import { WaActions } from "../../components/WaActions";
import { fmtDateTime, isLatePhase, pendingReason, phaseById, phaseList, phaseOf, progressFor, quotaOf } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { Member, RundownPeriod } from "../../lib/types";
import { designBarengMessage, reminderMessage } from "../../lib/wa";
import { logReminder, upsertFlag, useAdminData } from "./data";


export default function Reminders({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const options = phaseList(period);
  const auto = phaseOf(period).id;
  const [phaseId, setPhaseId] = useState<string>(auto);
  useEffect(() => setPhaseId(options.some((p) => p.id === auto) ? auto : options[0]?.id ?? "w1"), [auto, pm]);
  const phase = phaseById(period, phaseId);
  const q = quotaOf(period);
  const [fonnte, setFonnte] = useState<boolean | null>(null);
  const [blasting, setBlasting] = useState(false);
  useEffect(() => {
    supabase.functions.invoke("wa-blast", { body: { check: true } }).then(({ data: d }) => setFonnte(Boolean((d as { configured?: boolean })?.configured)));
  }, []);

  if (loading || !data) return <PageLoader />;
  const flagOf = (id: string) => data.flags.find((f) => f.member_id === id);
  const active = data.members.filter((m) => m.is_active && m.role === "member");
  const rows = active
    .map((m) => ({ m, pr: progressFor(m.id, data.stories, !!flagOf(m.id)?.taqdim_done) }))
    .map((r) => ({ ...r, reason: pendingReason(phase, r.pr, q) }))
    .filter((r) => r.reason)
    .sort((a, b) => a.pr.storiesSubmitted - b.pr.storiesSubmitted || a.m.name.localeCompare(b.m.name));
  const late = isLatePhase(phase, q);
  const ghosts = late ? rows.filter((r) => r.pr.storiesSubmitted === 0 && !flagOf(r.m.id)?.has_kabar) : [];
  const alerts = rows.filter((r) => !ghosts.includes(r));

  const logged = async (m: Member) => { await logReminder(m.id, pm, flagOf(m.id)); reload(); };
  const bareng = async (m: Member) => {
    await upsertFlag(m.id, pm, { design_bareng: true }).catch(() => undefined);
    reload();
  };
  const toggleKabar = async (m: Member) => {
    try { await upsertFlag(m.id, pm, { has_kabar: !flagOf(m.id)?.has_kabar }); reload(); } catch (e) { toast(errMsg(e), "err"); }
  };
  const setExcuse = async (m: Member) => {
    const v = prompt(`Keterangan berhalangan untuk ${m.name} (tampil di rekap WA):`, flagOf(m.id)?.excuse_note ?? "");
    if (v === null) return;
    try { await upsertFlag(m.id, pm, { excuse_note: v.trim() || null, has_kabar: !!v.trim() || flagOf(m.id)?.has_kabar }); reload(); } catch (e) { toast(errMsg(e), "err"); }
  };
  const blast = async () => {
    const targets = rows.filter((r) => data.phones[r.m.id]);
    if (!targets.length) return toast("Tidak ada nomor WA yang bisa dikirimi", "err");
    if (!confirm(`Kirim pengingat otomatis via Fonnte ke ${targets.length} anggota?`)) return;
    setBlasting(true);
    const { data: res, error } = await supabase.functions.invoke("wa-blast", {
      body: { messages: targets.map((r) => ({ member_id: r.m.id, message: reminderMessage(phase, r.m.name, period, r.reason) })) },
    });
    setBlasting(false);
    if (error) return toast(errMsg(error), "err");
    const sent = (res as { sent: number }).sent;
    await Promise.all(targets.map((r) => logReminder(r.m.id, pm, flagOf(r.m.id))));
    toast(`${sent}/${targets.length} pesan terkirim via Fonnte`);
    reload();
  };

  const Row = ({ r, ghost = false }: { r: (typeof rows)[number]; ghost?: boolean }) => {
    const f = flagOf(r.m.id);
    const phone = data.phones[r.m.id];
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{r.m.name} <span className="text-xs font-normal text-ink-muted">· {r.m.category}</span></p>
          <p className={`text-sm ${ghost ? "text-crimson-700" : "text-ink-body"}`}>{r.reason}</p>
          <p className="text-xs text-ink-muted">
            <span className="font-mono">{phone ?? "⚠️ nomor belum diisi"}</span>
            {f?.last_reminded_at && <> · diingatkan {f.reminder_count}× (terakhir {fmtDateTime(f.last_reminded_at)})</>}
            {f?.excuse_note && <> · 📝 {f.excuse_note}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`btn-sm ${f?.has_kabar ? "btn bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "btn-ghost"}`} onClick={() => toggleKabar(r.m)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {f?.has_kabar ? "Sudah berkabar" : "Tandai berkabar"}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setExcuse(r.m)}>Keterangan</button>
          {late && <WaActions phone={phone} message={designBarengMessage(r.m.name)} label={f?.design_bareng ? "Desain Bareng ✓" : "Desain Bareng, AYO!"} variant={f?.design_bareng ? "dark" : "soft"} copyLabel="Salin" onUse={() => bareng(r.m)} />}
          <WaActions phone={phone} message={reminderMessage(phase, r.m.name, period, r.reason)} label="Kirim Pengingat WA" onUse={() => logged(r.m)} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PhaseBanner period={period} compact />
      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <label className="block">
          <span className="label">Fase pengingat {phaseId === auto ? "(otomatis dari rundown)" : "(manual)"}</span>
          <select className="input w-auto" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            {options.map((p) => <option key={p.id} value={p.id}>{p.label}{p.id === auto ? " · aktif" : ""}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted"><b className="text-ink">{rows.length}</b> dari {active.length} anggota belum memenuhi target fase ini</span>
          {fonnte ? (
            <button className="btn-dark" onClick={blast} disabled={blasting || !rows.length}>{blasting ? <Spinner /> : <Send className="h-4 w-4" />} Blast otomatis (Fonnte)</button>
          ) : fonnte === false ? (
            <span className="badge-slate" title="Tambahkan secret FONNTE_TOKEN di Supabase untuk blast otomatis">Blast Fonnte: belum diatur</span>
          ) : null}
        </div>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-ink">Pratinjau template pesan fase ini</summary>
        <div className="mt-3 flex justify-end"><CopyButton text={reminderMessage(phase, "[Nama]", period, rows[0]?.reason)} label="Salin template" /></div>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-[12.5px] leading-relaxed text-ink">{reminderMessage(phase, "[Nama]", period, rows[0]?.reason)}</pre>
      </details>

      {rows.length === 0 ? (
        <Empty icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} title="Semua anggota aktif sudah memenuhi target fase ini">Alhamdulillah, tidak ada yang perlu diingatkan.</Empty>
      ) : (
        <>
          {alerts.length > 0 && (
            <div className={`card overflow-hidden ${phase.key === "sks" ? "ring-2 ring-crimson-500/40" : ""}`}>
              <div className={`flex items-center gap-2 px-4 py-3 font-display font-bold ${phase.key === "sks" ? "bg-crimson-grad text-white" : "border-b border-slate-100 text-ink"}`}>
                {phase.key === "sks" ? <Siren className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-crimson-600" />}
                {phase.key === "sks" ? `RED ALERT · Belum tuntas Story 1–${q}` : "Belum memenuhi target"} ({alerts.length})
              </div>
              <div className="divide-y divide-slate-100">{alerts.map((r) => <Row key={r.m.id} r={r} />)}</div>
            </div>
          )}
          {ghosts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 bg-ink px-4 py-3 font-display font-bold text-white"><Ghost className="h-4 w-4" /> Ghosting / Pasif · 0 setoran & tanpa kabar ({ghosts.length})</div>
              <div className="divide-y divide-slate-100">{ghosts.map((r) => <Row key={r.m.id} r={r} ghost />)}</div>
              <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-ink-muted">Lanjutkan ke tab Member → Radar untuk mengirim “Peringatan &amp; Konfirmasi Lanjut”.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
