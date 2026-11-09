import { CalendarPlus, Lock, LockOpen, Megaphone, Power, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, Markdown, Spinner, useToast } from "../../components/ui";
import {
  currentMonthJakarta, deadlinesOf, EMOJI_BULAN, evenPreset, fmtDateTime, legacyWindows, monthLabel, quotaOf, weeklyPreset,
  type PeriodDates,
} from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { RundownPeriod } from "../../lib/types";

const DOTS = ["🔵", "🔴", "🟠", "🟣", "🔵", "🔴"];

export default function RundownSettings({ periods, selected, onSelect }: { periods: RundownPeriod[]; selected: string; onSelect: (pm: string) => void }) {
  const toast = useToast();
  const p = periods.find((x) => x.period_month === selected) ?? null;
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [dates, setDates] = useState<PeriodDates | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newPm, setNewPm] = useState("");
  const [newQuota, setNewQuota] = useState(4);

  useEffect(() => {
    if (!p) return;
    setLabel(p.label ?? ""); setEmoji(p.emoji); setNotes(p.monthly_evaluation_notes ?? "");
    setDates({
      w1_start: p.w1_start, w1_end: p.w1_end, w2_start: p.w2_start, w2_end: p.w2_end, w3_start: p.w3_start, w3_end: p.w3_end,
      w4_start: p.w4_start, w4_end: p.w4_end, sks_start: p.sks_start ?? "", recap_date: p.recap_date ?? "",
      story_quota: quotaOf(p), story_deadlines: deadlinesOf(p),
    });
  }, [p?.id, p?.monthly_evaluation_notes, p?.w1_start, p?.w4_end, p?.story_quota, p?.story_deadlines?.join()]);

  useEffect(() => {
    const cur = currentMonthJakarta();
    const [y, m] = cur.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    setNewPm(periods.some((x) => x.period_month === cur) ? next : cur);
    const latest = [...periods].sort((a, b) => b.period_month.localeCompare(a.period_month))[0];
    if (latest) setNewQuota(quotaOf(latest));
  }, [periods.length]);

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) toast(errMsg(error), "err"); else toast(ok);
  };

  const setQuota = (q: number) => {
    if (!p || !dates) return;
    setDates(weeklyPreset(p.period_month, q));
  };
  const setDeadline = (i: number, v: string) => setDates((d) => (d ? { ...d, story_deadlines: d.story_deadlines.map((x, j) => (j === i ? v : x)) } : d));

  const saveDates = () => {
    if (!p || !dates) return;
    const dls = dates.story_deadlines;
    if (dls.length !== dates.story_quota || dls.some((d) => !d)) return toast("Lengkapi tenggat setiap story", "err");
    if (dates.w1_end < dates.w1_start) return toast("Tanggal taqdim tidak valid", "err");
    if (dls[0] <= dates.w1_end) return toast("Tenggat Story 1 harus setelah masa taqdim selesai", "err");
    if (dls.some((d, i) => i && d <= dls[i - 1])) return toast("Tenggat story harus berurutan", "err");
    const payload = {
      ...dates, ...legacyWindows(p.period_month, dates.w1_end, dls),
      sks_start: dates.sks_start || null, recap_date: dates.recap_date || null, label: label || null, emoji: emoji || "✨",
    };
    run("dates", () => supabase.from("rundown_periods").update(payload).eq("id", p.id), "Rundown tersimpan");
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
    await run("new", () => supabase.from("rundown_periods").insert({ period_month: newPm, label: `Rundown ${monthLabel(newPm)}`, emoji: EMOJI_BULAN[m], ...weeklyPreset(newPm, newQuota), is_active: false }), "Periode baru dibuat");
    onSelect(newPm);
  };

  const D = ({ k, l }: { k: "w1_start" | "w1_end" | "sks_start" | "recap_date"; l: string }) => (
    <Field label={l}><input type="date" className="input font-mono" value={dates?.[k] ?? ""} onChange={(e) => setDates((d) => (d ? { ...d, [k]: e.target.value } : d))} /></Field>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
        {p && dates ? (
          <div className="card space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="label">Jadwal rundown</p>
                <p className="font-display text-xl font-bold text-ink">{p.emoji} {monthLabel(p.period_month)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.is_active ? <span className="badge-green">Aktif</span> : <button className="btn-ghost btn-sm" onClick={activate} disabled={busy === "act"}><Power className="h-3.5 w-3.5" /> Jadikan aktif</button>}
                <button className="btn-ghost btn-sm" onClick={() => run("lock", () => supabase.from("rundown_periods").update({ is_locked: !p.is_locked }).eq("id", p.id), p.is_locked ? "Periode dibuka" : "Periode dikunci")}>
                  {p.is_locked ? <><LockOpen className="h-3.5 w-3.5" /> Buka kunci</> : <><Lock className="h-3.5 w-3.5" /> Kunci</>}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px_140px] gap-3">
              <Field label="Label"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
              <Field label="Emoji"><input className="input text-center text-lg" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} /></Field>
              <Field label="Target story">
                <select className="input" value={dates.story_quota} onChange={(e) => setQuota(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} story</option>)}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-soft btn-sm" onClick={() => setDates(weeklyPreset(p.period_month, dates.story_quota))}>Preset standar (Taqdim Hari 1–3, tenggat 9 / 16 / 23 / akhir bulan)</button>
              <button className="btn-soft btn-sm" onClick={() => setDates(evenPreset(p.period_month, dates.story_quota, 10))}>Preset ala Rundown Oktober (taqdim s/d tgl 10)</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <D k="w1_start" l="🟢 Taqdim mulai" /><D k="w1_end" l="🟢 Taqdim selesai" />
              {dates.story_deadlines.map((d, i) => (
                <Field key={i} label={`${DOTS[i % DOTS.length]} Tenggat Story ${i + 1}`}>
                  <input type="date" className="input font-mono" value={d} onChange={(e) => setDeadline(i, e.target.value)} />
                </Field>
              ))}
              {dates.story_deadlines.length % 2 === 1 && <div />}
              <D k="sks_start" l="🟡 Fase SKS mulai" /><D k="recap_date" l="Tanggal rekapan & evaluasi" />
            </div>
            {p.is_locked && <p className="text-xs text-amber-800">Periode ini terkunci — member tidak bisa mengubah taqdim/setoran.</p>}
            <button className="btn-primary" onClick={saveDates} disabled={busy === "dates"}>{busy === "dates" ? <Spinner /> : <Save className="h-4 w-4" />} Simpan rundown</button>
          </div>
        ) : <p className="text-sm text-ink-muted">Pilih periode.</p>}

        <div className="card flex flex-wrap items-end gap-3 p-5">
          <Field label="Buat periode baru"><input type="month" className="input font-mono" value={newPm} onChange={(e) => setNewPm(e.target.value)} /></Field>
          <Field label="Target">
            <select className="input" value={newQuota} onChange={(e) => setNewQuota(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} story</option>)}</select>
          </Field>
          <button className="btn-dark" onClick={create} disabled={busy === "new"}><CalendarPlus className="h-4 w-4" /> Buat dengan preset mingguan</button>
        </div>
      </div>

      {p && (
        <div className="card h-fit space-y-4 p-5">
          <div>
            <p className="label flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Evaluasi Bulanan</p>
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
