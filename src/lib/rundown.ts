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

export interface PeriodDates {
  w1_start: string; w1_end: string;
  w2_start: string; w2_end: string;
  w3_start: string; w3_end: string;
  w4_start: string; w4_end: string;
  sks_start: string; recap_date: string;
  story_quota: number;
  story_deadlines: string[];
}

const lastDayOf = (pm: string) => { const [y, m] = pm.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const dayOf = (pm: string, n: number) => `${pm}-${String(Math.max(1, Math.min(n, lastDayOf(pm)))).padStart(2, "0")}`;

/** Kolom w2–w4 lama diisi dari tenggat story agar tetap konsisten */
export function legacyWindows(pm: string, taqdimEnd: string, deadlines: string[]) {
  const last = dayOf(pm, 31);
  const d1 = deadlines[0] ?? last, d2 = deadlines[1] ?? d1;
  return {
    w2_start: addDays(taqdimEnd, 1), w2_end: d1,
    w3_start: addDays(d1, 1) > d2 ? d2 : addDays(d1, 1), w3_end: d2,
    w4_start: addDays(d2, 1) > last ? last : addDays(d2, 1), w4_end: last,
  };
}

/**
 * Preset mingguan (standar tim): Taqdim Hari 1–3, tenggat Story di Hari 9, 16, 23, … dan story terakhir di akhir bulan.
 * Bila kuota terlalu banyak untuk pola itu, tenggat dihitung mundur 7 hari dari akhir bulan.
 */
export function weeklyPreset(pm: string, quota = 4): PeriodDates {
  const last = lastDayOf(pm);
  const fits = quota >= 2 && 9 + 7 * (quota - 2) < last;
  const deadlines = fits
    ? [...Array.from({ length: quota - 1 }, (_, i) => dayOf(pm, 9 + 7 * i)), dayOf(pm, last)]
    : Array.from({ length: quota }, (_, i) => dayOf(pm, last - 7 * (quota - 1 - i)));
  const taqdimEnd = fits ? dayOf(pm, 3) : dayOf(pm, Math.max(1, Number(deadlines[0].slice(8)) - 6));
  return {
    w1_start: dayOf(pm, 1), w1_end: taqdimEnd, ...legacyWindows(pm, taqdimEnd, deadlines),
    sks_start: dayOf(pm, last - 3), recap_date: dayOf(pm, last), story_quota: quota, story_deadlines: deadlines,
  };
}

/** Preset ala "Rundown Oktober": Taqdim s/d tanggal X, sisa bulan dibagi rata untuk tiap story */
export function evenPreset(pm: string, quota = 4, taqdimDay = 10): PeriodDates {
  const last = lastDayOf(pm);
  const span = last - taqdimDay;
  const deadlines = Array.from({ length: quota }, (_, i) => dayOf(pm, taqdimDay + Math.round((span * (i + 1)) / quota)));
  const taqdimEnd = dayOf(pm, taqdimDay);
  return {
    w1_start: dayOf(pm, 1), w1_end: taqdimEnd, ...legacyWindows(pm, taqdimEnd, deadlines),
    sks_start: dayOf(pm, last - 2), recap_date: dayOf(pm, last), story_quota: quota, story_deadlines: deadlines,
  };
}

export const quotaOf = (p: RundownPeriod | null | undefined) => p?.story_quota ?? 4;
export function deadlinesOf(p: RundownPeriod | null | undefined): string[] {
  if (!p) return [];
  if (p.story_deadlines?.length) return p.story_deadlines;
  return [p.w2_end, p.w3_end, p.w4_end].slice(0, quotaOf(p));
}
export const storyNums = (quota: number) => Array.from({ length: quota }, (_, i) => i + 1);

export type PhaseKey = "pre" | "w1" | "w1_rev" | "story" | "sks" | "done";

export interface PhaseInfo {
  key: PhaseKey;
  /** id unik fase, mis. "w1", "story:2", "sks" */
  id: string;
  storyN: number | null;
  /** urutan untuk tampilan: 0 pra, 1 taqdim, 1+n story ke-n, 99 selesai */
  step: number;
  title: string;
  subtitle: string;
  endsOn: string | null;
  daysLeft: number | null;
  tone: "green" | "blue" | "red" | "amber" | "slate";
}

const TONES: PhaseInfo["tone"][] = ["blue", "red", "amber", "blue", "red", "amber"];

function storyPhase(p: RundownPeriod, n: number, today: string): PhaseInfo {
  const dl = deadlinesOf(p)[n - 1];
  return {
    key: "story", id: `story:${n}`, storyN: n, step: 1 + n,
    title: `Story ${n} · Pengerjaan & QC`, subtitle: `Story ${n} wajib disetor paling lambat ${fmtDate(dl)}.`,
    endsOn: dl, daysLeft: diffDays(today, dl), tone: TONES[(n - 1) % TONES.length],
  };
}

export function phaseOf(p: RundownPeriod | null | undefined, today = todayJakarta()): PhaseInfo {
  const base = { storyN: null, endsOn: null, daysLeft: null } as const;
  if (!p) return { ...base, key: "pre", id: "pre", step: 0, title: "Belum ada rundown aktif", subtitle: "Admin belum mengaktifkan periode.", tone: "slate" };
  const q = quotaOf(p);
  const left = (end: string) => diffDays(today, end);
  if (today < p.w1_start) return { ...base, key: "pre", id: "pre", step: 0, title: "Rundown belum dimulai", subtitle: `Dimulai ${fmtDate(p.w1_start)}`, endsOn: p.w1_start, daysLeft: left(p.w1_start), tone: "slate" };
  if (today <= p.w1_end) {
    const span = diffDays(p.w1_start, p.w1_end);
    // Revisi & finalisasi = 2 hari terakhir masa taqdim (Hari 6–7 dari 7; hari terakhir bila taqdim singkat)
    const revStart = span >= 6 ? addDays(p.w1_end, -1) : span >= 2 ? p.w1_end : null;
    if (revStart && today >= revStart)
      return { ...base, key: "w1_rev", id: "w1_rev", step: 1, title: "Taqdim · Tenggat Revisi & Finalisasi", subtitle: "Selesaikan revisi konsep sebelum masa desain dimulai.", endsOn: p.w1_end, daysLeft: left(p.w1_end), tone: "green" };
    return { ...base, key: "w1", id: "w1", step: 1, title: `Taqdim ${q} Konsep Story`, subtitle: `Ajukan ${q} konsep (judul, ringkasan, poin visual) untuk divalidasi admin.`, endsOn: p.w1_end, daysLeft: left(p.w1_end), tone: "green" };
  }
  const dls = deadlinesOf(p);
  const lastDl = dls[dls.length - 1] ?? p.w4_end;
  if (p.sks_start && today >= p.sks_start && today <= lastDl)
    return { ...base, key: "sks", id: "sks", step: 1 + q, title: "Fase SKS & Validasi Akhir", subtitle: `Tuntaskan Story 1–${q}. Butuh bantuan? Desain Bareng Admin, AYO!`, endsOn: lastDl, daysLeft: left(lastDl), tone: "amber" };
  const n = dls.findIndex((d) => today <= d);
  if (n >= 0) return storyPhase(p, n + 1, today);
  return { ...base, key: "done", id: "done", step: 99, title: "Rundown selesai · Evaluasi Bulanan", subtitle: "Rekap dan evaluasi bulan ini sedang/sudah dipublikasikan.", tone: "slate" };
}

/** Daftar fase yang bisa dipilih manual (panel pengingat) */
export function phaseList(p: RundownPeriod | null | undefined): { id: string; label: string }[] {
  if (!p) return [];
  const dls = deadlinesOf(p);
  return [
    { id: "w1", label: `Taqdim ${quotaOf(p)} konsep (s/d ${fmtDate(p.w1_end)})` },
    { id: "w1_rev", label: "Taqdim · revisi & finalisasi" },
    ...dls.map((d, i) => ({ id: `story:${i + 1}`, label: `Story ${i + 1} (tenggat ${fmtDate(d)})` })),
    { id: "sks", label: `SKS & Desain Bareng${p.sks_start ? ` (mulai ${fmtDate(p.sks_start)})` : ""}` },
  ];
}

export function phaseById(p: RundownPeriod | null | undefined, id: string, today = todayJakarta()): PhaseInfo {
  const cur = phaseOf(p, today);
  if (!p || id === cur.id) return cur;
  const q = quotaOf(p);
  const base = { storyN: null, endsOn: null, daysLeft: null } as const;
  if (id === "w1") return { ...base, key: "w1", id, step: 1, title: `Taqdim ${q} Konsep Story`, subtitle: "", endsOn: p.w1_end, tone: "green" };
  if (id === "w1_rev") return { ...base, key: "w1_rev", id, step: 1, title: "Taqdim · Revisi", subtitle: "", endsOn: p.w1_end, tone: "green" };
  if (id === "sks") return { ...base, key: "sks", id, step: 1 + q, title: "Fase SKS", subtitle: "", endsOn: deadlinesOf(p)[q - 1] ?? null, tone: "amber" };
  if (id.startsWith("story:")) return storyPhase(p, Number(id.split(":")[1]), today);
  return cur;
}

/** Fase akhir bulan: radar "tidak aktif / tanpa kabar" mulai berlaku */
export const isLatePhase = (ph: PhaseInfo, quota: number) => ph.key === "sks" || ph.key === "done" || (ph.key === "story" && (ph.storyN ?? 0) >= quota);

export interface MemberProgress {
  conceptsSubmitted: number;
  conceptsAcc: number;
  conceptsRevision: number;
  storiesSubmitted: number;
  storiesAcc: number;
  has: (n: number) => boolean;
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
export function pendingReason(ph: PhaseInfo, pr: MemberProgress, quota: number): string | null {
  switch (ph.key) {
    case "w1":
    case "w1_rev":
      if (pr.conceptsSubmitted < quota) return `Belum taqdim konsep (${pr.conceptsSubmitted}/${quota})`;
      if (pr.conceptsRevision > 0) return `${pr.conceptsRevision} konsep perlu revisi`;
      return null;
    case "story": {
      const upto = ph.storyN ?? 1;
      const miss = storyNums(upto).filter((n) => !pr.has(n));
      if (!miss.length) return null;
      return upto >= quota ? `Belum tuntas: Story ${miss.join(", ")} (${quota - miss.length}/${quota})` : `Belum setor Story ${miss.join(" & ")}`;
    }
    case "sks": {
      const miss = storyNums(quota).filter((n) => !pr.has(n));
      return miss.length ? `Belum tuntas: Story ${miss.join(", ")} (${quota - miss.length}/${quota})` : null;
    }
    default:
      return null;
  }
}

export function progressEmoji(n: number, quota = 4): string {
  if (n >= quota) return "🎉";
  if (n === 0) return "⏳";
  return n >= quota - 1 ? "🚀" : n >= Math.ceil(quota / 2) ? "🔥" : "💪";
}
