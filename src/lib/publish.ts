import { todayJakarta } from "./rundown";
import type { Story } from "./types";

export function toJakartaDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Hari ini → sekarang; tanggal mendatang → 07.00 WIB; tanggal lampau → 19.00 WIB (tetap pakai waktu lama bila tanggalnya sama) */
export function publishInstant(date: string, existing?: string | null): string {
  if (existing && toJakartaDate(existing) === date) return existing;
  const today = todayJakarta();
  if (date === today) return new Date().toISOString();
  return new Date(`${date}T${date > today ? "07:00" : "19:00"}:00+07:00`).toISOString();
}

/** Label singkat setoran: "Story 2" atau "Special Edition" */
export function storyLabel(s: Pick<Story, "story_target" | "special_id">, short = false): string {
  if (s.special_id) return short ? "SE" : "Special Edition";
  return short ? `S${s.story_target}` : `Story ${s.story_target}`;
}

export type PubStage = "qc" | "revision" | "need_final" | "final_ready" | "scheduled" | "published";

/** Tahap publikasi setoran: QC → ACC (menunggu watermark) → final siap → terbit */
export function pubStage(s: Pick<Story, "qc_status" | "final_url" | "is_published_to_showcase" | "published_at">): PubStage {
  if (s.qc_status === "pending_qc") return "qc";
  if (s.qc_status === "revision") return "revision";
  if (s.is_published_to_showcase) return s.published_at && new Date(s.published_at) > new Date() ? "scheduled" : "published";
  return s.final_url ? "final_ready" : "need_final";
}

export const STAGE_LABEL: Record<PubStage, { text: string; cls: string }> = {
  qc: { text: "Menunggu QC", cls: "badge-blue" },
  revision: { text: "Revisi QC", cls: "badge-red" },
  need_final: { text: "ACC · menunggu watermark", cls: "badge-amber" },
  final_ready: { text: "Final siap terbit", cls: "badge-green" },
  scheduled: { text: "Terjadwal", cls: "badge-amber" },
  published: { text: "Terbit di galeri", cls: "badge-dark" },
};
