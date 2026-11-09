import { STAGE_LABEL, pubStage } from "./publish";
import { diffDays, todayJakarta } from "./rundown";
import type { SpecialEdition, Story } from "./types";

export interface SpecialStatus { text: string; cls: string; sent: boolean }

export function specialStatus(sp: SpecialEdition, sub: Story | undefined, today = todayJakarta()): SpecialStatus {
  if (sub) {
    const st = pubStage(sub);
    return { text: st === "qc" ? "Terkirim · menunggu QC" : STAGE_LABEL[st].text, cls: st === "revision" ? "badge-red" : "badge-green", sent: true };
  }
  if (sp.marked_sent) return { text: "Ditandai terkirim (manual)", cls: "badge-green", sent: true };
  const left = diffDays(today, sp.deadline);
  if (left < 0) return { text: `Lewat deadline ${Math.abs(left)} hari · belum dikirim`, cls: "badge-red", sent: false };
  return { text: left === 0 ? "Deadline hari ini · belum dikirim" : `Belum dikirim · ${left} hari lagi`, cls: left <= 2 ? "badge-amber" : "badge-slate", sent: false };
}

