import type { Concept, RundownPeriod, Story } from "./types";

export const EMOJI_BULAN: Record<number, string> = {
  1: "🎆", 2: "💐", 3: "🌱", 4: "🌷", 5: "🌼", 6: "🌺",
  7: "🌊", 8: "☀️", 9: "🍂", 10: "🎃", 11: "🍁", 12: "❄️",
};
export const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function currentMonthJakarta(): string {
  return todayJakarta().slice(0, 7);
}
export function monthLabel(pm: string): string {
  const [y, m] = pm.split("-").map(Number);
  return `${NAMA_BULAN[m - 1]} ${y}`;
}
export function emojiFor(pm: string, period?: RundownPeriod | null): string {
  return period?.emoji || EMOJI_BULAN[Number(pm.split("-")[1])] || "✨";
}
export function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}
export function fmtDate(d: string | null | undefined, withYear = false): string {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${NAMA_BULAN[m - 1].slice(0, 3)}${withYear ? " " + y : ""}`;
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Preset standar Hari 1–30 untuk bulan tertentu */
export function standardPreset(pm: string) {
  const [y, m] = pm.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = (n: number) => `${pm}-${String(Math.min(n, last)).padStart(2, "0")}`;
  return {
    w1_start: d(1), w1_end: d(7), w2_start: d(8), w2_end: d(14), w3_start: d(15), w3_end: d(21),
    w4_start: d(22), w4_end: d(last), sks_start: d(27), recap_date: d(last),
  };
}
/** Preset bergeser ala "Rundown Oktober": Taqdim s/d tgl X, lalu 3 blok desain 7 hari */
export function shiftedPreset(pm: string, taqdimDay = 10) {
  const [y, m] = pm.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = (n: number) => `${pm}-${String(Math.min(n, last)).padStart(2, "0")}`;
  return {
    w1_start: d(1), w1_end: d(taqdimDay), w2_start: d(taqdimDay + 1), w2_end: d(taqdimDay + 7),
    w3_start: d(taqdimDay + 8), w3_end: d(taqdimDay + 14), w4_start: d(taqdimDay + 15), w4_end: d(last),
    sks_start: d(last - 2), recap_date: d(last),
  };
}

export type PhaseKey = "pre" | "w1" | "w1_rev" | "w2" | "w3" | "w4" | "sks" | "done";

export interface PhaseInfo {
  key: PhaseKey;
  week: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  endsOn: string | null;
  daysLeft: number | null;
  tone: "green" | "blue" | "red" | "amber" | "slate";
}

export function phaseOf(p: RundownPeriod | null | undefined, today = todayJakarta()): PhaseInfo {
  if (!p) return { key: "pre", week: 0, title: "Belum ada rundown aktif", subtitle: "Admin belum mengaktifkan periode.", endsOn: null, daysLeft: null, tone: "slate" };
  const left = (end: string) => diffDays(today, end);
  if (today < p.w1_start) return { key: "pre", week: 0, title: "Rundown belum dimulai", subtitle: `Dimulai ${fmtDate(p.w1_start)}`, endsOn: p.w1_start, daysLeft: left(p.w1_start), tone: "slate" };
  if (today <= p.w1_end) {
    const span = diffDays(p.w1_start, p.w1_end);
    const revStart = span >= 6 ? addDays(p.w1_start, 5) : p.w1_end;
    if (today >= revStart && span >= 6)
      return { key: "w1_rev", week: 1, title: "Minggu 1 · Tenggat Revisi & Finalisasi Taqdim", subtitle: "Selesaikan revisi konsep sebelum minggu desain dimulai.", endsOn: p.w1_end, daysLeft: left(p.w1_end), tone: "green" };
    return { key: "w1", week: 1, title: "Minggu 1 · Taqdim 3 Konsep Story", subtitle: "Ajukan 3 konsep (judul, ringkasan, poin visual) untuk divalidasi admin.", endsOn: p.w1_end, daysLeft: left(p.w1_end), tone: "green" };
  }
  if (today <= p.w2_end) return { key: "w2", week: 2, title: "Minggu 2 · Pengerjaan & QC Story 1", subtitle: `Story 1 wajib disetor paling lambat ${fmtDate(p.w2_end)}.`, endsOn: p.w2_end, daysLeft: left(p.w2_end), tone: "blue" };
  if (today <= p.w3_end) return { key: "w3", week: 3, title: "Minggu 3 · Pengerjaan & QC Story 2", subtitle: `Story 2 wajib disetor paling lambat ${fmtDate(p.w3_end)}.`, endsOn: p.w3_end, daysLeft: left(p.w3_end), tone: "red" };
  if (today <= p.w4_end) {
    if (p.sks_start && today >= p.sks_start)
      return { key: "sks", week: 4, title: "Minggu 4 · Fase SKS & Validasi Akhir", subtitle: "Tuntaskan Story 1–3. Butuh bantuan? Desain Bareng Admin, AYO!", endsOn: p.w4_end, daysLeft: left(p.w4_end), tone: "amber" };
    return { key: "w4", week: 4, title: "Minggu 4 · Pengerjaan & QC Story 3", subtitle: `Story 3 dan seluruh setoran tuntas sebelum ${fmtDate(p.w4_end)}.`, endsOn: p.w4_end, daysLeft: left(p.w4_end), tone: "amber" };
  }
  return { key: "done", week: 5, title: "Rundown selesai · Evaluasi Bulanan", subtitle: "Rekap dan evaluasi bulan ini sedang/sudah dipublikasikan.", endsOn: null, daysLeft: null, tone: "slate" };
}

export interface MemberProgress {
  conceptsSubmitted: number;
  conceptsAcc: number;
  conceptsRevision: number;
  storiesSubmitted: number;
  storiesAcc: number;
  has: (n: 1 | 2 | 3) => boolean;
}

export function progressFor(memberId: string, concepts: Concept[], stories: Story[]): MemberProgress {
  const c = concepts.filter((x) => x.member_id === memberId);
  const s = stories.filter((x) => x.member_id === memberId);
  return {
    conceptsSubmitted: c.length,
    conceptsAcc: c.filter((x) => x.status === "acc").length,
    conceptsRevision: c.filter((x) => x.status === "revision").length,
    storiesSubmitted: s.length,
    storiesAcc: s.filter((x) => x.qc_status === "acc").length,
    has: (n) => s.some((x) => x.story_target === n),
  };
}

/** Alasan member belum memenuhi target fase yang sedang berjalan (null = sudah aman) */
export function pendingReason(phase: PhaseKey, pr: MemberProgress): string | null {
  switch (phase) {
    case "w1":
    case "w1_rev":
      if (pr.conceptsSubmitted < 3) return `Belum taqdim konsep (${pr.conceptsSubmitted}/3)`;
      if (pr.conceptsRevision > 0) return `${pr.conceptsRevision} konsep perlu revisi`;
      return null;
    case "w2":
      return pr.has(1) ? null : "Belum setor Story 1";
    case "w3": {
      const miss = [1, 2].filter((n) => !pr.has(n as 1 | 2));
      return miss.length ? `Belum setor Story ${miss.join(" & ")}` : null;
    }
    case "w4":
    case "sks": {
      const miss = [1, 2, 3].filter((n) => !pr.has(n as 1 | 2 | 3));
      return miss.length ? `Belum tuntas: Story ${miss.join(", ")} (${3 - miss.length}/3)` : null;
    }
    default:
      return null;
  }
}

export function progressEmoji(n: number): string {
  return n >= 3 ? "🎉" : n === 2 ? "🚀" : n === 1 ? "💪" : "⏳";
}
