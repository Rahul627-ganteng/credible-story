import { CalendarPlus, Lock, LockOpen, Megaphone, Power, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, Markdown, Spinner, useToast } from "../../components/ui";
import { currentMonthJakarta, EMOJI_BULAN, fmtDateTime, monthLabel, shiftedPreset, standardPreset } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod } from "../../lib/types";

type Dates = Pick<RundownPeriod, "w1_start" | "w1_end" | "w2_start" | "w2_end" | "w3_start" | "w3_end" | "w4_start" | "w4_end"> & { sks_start: string; recap_date: string };

export default function RundownSettings({ periods, selected, onSelect }: { periods: RundownPeriod[]; selected: string; onSelect: (pm: string) => void }) {
  const toast = useToast();
  const p = periods.find((x) => x.period_month === selected) ?? null;
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [dates, setDates] = useState<Dates | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newPm, setNewPm] = useState("");

  useEffect(() => {
    if (!p) return;
    setLabel(p.label ?? ""); setEmoji(p.emoji); setNotes(p.monthly_evaluation_notes ?? "");
    setDates({ w1_start: p.w1_start, w1_end: p.w1_end, w2_start: p.w2_start, w2_end: p.w2_end, w3_start: p.w3_start, w3_end: p.w3_end, w4_start: p.w4_start, w4_end: p.w4_end, sks_start: p.sks_start ?? "", recap_date: p.recap_date ?? "" });
  }, [p?.id, p?.monthly_evaluation_notes, p?.w1_start, p?.w4_end]);

  useEffect(() => {
    const cur = currentMonthJakarta();
    const [y, m] = cur.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    setNewPm(periods.some((x) => x.period_month === cur) ? next : cur);
  }, [periods.length]);

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) toast(errMsg(error), "err"); else toast(ok);
  };

  const saveDates = () => {
    if (!p || !dates) return;
    const order = [dates.w1_start, dates.w1_end, dates.w2_start, dates.w2_end, dates.w3_start, dates.w3_end, dates.w4_start, dates.w4_end];
    if (order.some((d, i) => i && d < order[i - 1])) return toast("Urutan tanggal fase tidak valid", "err");
    run("dates", () => supabase.from("rundown_periods").update({ ...dates, sks_start: dates.sks_start || null, recap_date: dates.recap_date || null, label: label || null, emoji: emoji || "✨" }).eq("id", p.id), "Rundown tersimpan");
  };
  const activate = async () => {
    if (!p) return;
    setBusy("act");
    const off = await supabase.from("rundown_periods").update({ is_active: false }).eq("is_active", true).neq("id", p.id);
    const on = off.error ? off : await supabase.from("rundown_periods").update({ is_active: true }).eq("id", p.id);
    setBusy(null);
    if (on.error) toast(errMsg(on.error), "err"); else toast(`${monthLabel(p.period_month)} jadi rundown aktif`);
  };
  const publishEval = () => {
    if (!p || notes.trim().length < 10) return toast("Tulis catatan evaluasi terlebih dahulu", "err");
    if (!confirm("Publikasikan evaluasi ke dashboard seluruh member dan kunci rekap bulan ini?")) return;
    run("eval", () => supabase.from("rundown_periods").update({ monthly_evaluation_notes: notes.trim(), evaluation_published_at: new Date().toISOString(), is_locked: true }).eq("id", p.id), "Evaluasi dipublikasikan & periode dikunci");
  };
  const create = async () => {
    if (!/^\d{4}-\d{2}$/.test(newPm)) return toast("Format bulan tidak valid", "err");
    if (periods.some((x) => x.period_month === newPm)) return toast("Periode itu sudah ada", "err");
    const m = Number(newPm.split("-")[1]);
    await run("new", () => supabase.from("rundown_periods").insert({ period_month: newPm, label: `Rundown ${monthLabel(newPm)}`, emoji: EMOJI_BULAN[m], ...standardPreset(newPm), is_active: false }), "Periode baru dibuat");
    onSelect(newPm);
  };

  const D = ({ k, l }: { k: keyof Dates; l: string }) => (
    <Field label={l}><input type="date" className="input font-mono" value={dates?.[k] ?? ""} onChange={(e) => setDates((d) => (d ? { ...d, [k]: e.target.value } : d))} /></Field>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
        {p && dates ? (
          <div className="card space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="label">Jadwal fase</p>
                <p className="font-display text-xl font-bold text-ink">{p.emoji} {monthLabel(p.period_month)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.is_active ? <span className="badge-green">Aktif</span> : <button className="btn-ghost btn-sm" onClick={activate} disabled={busy === "act"}><Power className="h-3.5 w-3.5" /> Jadikan aktif</button>}
                <button className="btn-ghost btn-sm" onClick={() => run("lock", () => supabase.from("rundown_periods").update({ is_locked: !p.is_locked }).eq("id", p.id), p.is_locked ? "Periode dibuka" : "Periode dikunci")}>
                  {p.is_locked ? <><LockOpen className="h-3.5 w-3.5" /> Buka kunci</> : <><Lock className="h-3.5 w-3.5" /> Kunci</>}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Label"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
              <Field label="Emoji"><input className="input text-center text-lg" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-soft btn-sm" onClick={() => setDates(standardPreset(p.period_month))}>Preset standar (Hari 1–30)</button>
              <button className="btn-soft btn-sm" onClick={() => setDates(shiftedPreset(p.period_month, 10))}>Preset ala Rundown Oktober (Taqdim s/d tgl 10)</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <D k="w1_start" l="🟢 Minggu 1 mulai" /><D k="w1_end" l="🟢 Minggu 1 selesai" />
              <D k="w2_start" l="🔵 Minggu 2 mulai" /><D k="w2_end" l="🔵 Tenggat Story 1" />
              <D k="w3_start" l="🔴 Minggu 3 mulai" /><D k="w3_end" l="🔴 Tenggat Story 2" />
              <D k="w4_start" l="🟡 Minggu 4 mulai" /><D k="w4_end" l="🟡 Tenggat akhir" />
              <D k="sks_start" l="Fase SKS mulai" /><D k="recap_date" l="Tanggal rekapan" />
            </div>
            <button className="btn-primary" onClick={saveDates} disabled={busy === "dates"}>{busy === "dates" ? <Spinner /> : <Save className="h-4 w-4" />} Simpan rundown</button>
          </div>
        ) : <p className="text-sm text-ink-muted">Pilih periode.</p>}

        <div className="card flex flex-wrap items-end gap-3 p-5">
          <Field label="Buat periode baru"><input type="month" className="input font-mono" value={newPm} onChange={(e) => setNewPm(e.target.value)} /></Field>
          <button className="btn-dark" onClick={create} disabled={busy === "new"}><CalendarPlus className="h-4 w-4" /> Buat dengan preset standar</button>
        </div>
      </div>

      {p && (
        <div className="card h-fit space-y-4 p-5">
          <div>
            <p className="label flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Evaluasi Bulanan (Hari 30)</p>
            <p className="text-xs text-ink-muted">Tampil di dashboard seluruh member. Mendukung Markdown (**tebal**, daftar, dll). Publikasi juga mengunci rekap periode ini.</p>
          </div>
          <textarea className="input min-h-[220px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"Alhamdulillah…\n\n**Catatan bulan depan:**\n1. …"} />
          {notes.trim() && <div className="rounded-xl border border-slate-200 p-3"><p className="label">Pratinjau</p><Markdown>{notes}</Markdown></div>}
          {p.evaluation_published_at && <p className="text-xs text-ink-muted">Terakhir dipublikasikan {fmtDateTime(p.evaluation_published_at)}</p>}
          <button className="btn-primary w-full" onClick={publishEval} disabled={busy === "eval"}>{busy === "eval" ? <Spinner /> : <Megaphone className="h-4 w-4" />} Publikasikan & kunci rekap</button>
        </div>
      )}
    </div>
  );
}
