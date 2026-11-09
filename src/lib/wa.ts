import type { PhaseInfo } from "./rundown";
import { deadlinesOf, fmtDate, monthLabel, quotaOf } from "./rundown";
import { SPECIAL_WEIGHT, type Category, type Member, type RundownPeriod, type SpecialEdition } from "./types";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.startsWith("8")) d = "62" + d;
  d = d.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const p = normalizePhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null;
}

export const portalUrl = () => (typeof window !== "undefined" ? window.location.origin : "");

export function reminderMessage(ph: PhaseInfo, name: string, period: RundownPeriod | null, reason?: string | null): string {
  const bln = period ? monthLabel(period.period_month) : "bulan ini";
  const link = portalUrl();
  const q = quotaOf(period);
  const dls = deadlinesOf(period);
  switch (ph.key) {
    case "w1":
      return `Assalamu'alaikum ${name} 👋\n\nPengingat Rundown *${bln}* — saat ini masa *Taqdim Konsep*.\nYuk kirim *taqdim ${q} konsep story* kamu ke admin lewat WhatsApp sebelum *${period ? fmtDate(period.w1_end) : "tenggat"}* (judul/topik, ringkasan, dan gambaran visual), supaya bisa dicek sebelum mulai desain.\n${reason ? `\nStatus kamu: ${reason}\n` : ""}\nJazakallahu khairan 🙏`;
    case "w1_rev":
      return `Assalamu'alaikum ${name} 👋\n\nMasa *Taqdim Konsep* Rundown *${bln}* berakhir *${period ? fmtDate(period.w1_end) : "segera"}*.\n${reason ? `Status kamu: *${reason}*.\n` : ""}Mohon segera kirim taqdim ${q} konsep story kamu ke admin lewat WhatsApp ya. Kalau bingung cari topik, kabari admin 🙂\n\nJazakallahu khairan 🙏`;
    case "story": {
      const n = ph.storyN ?? 1;
      const last = n >= q;
      return `Assalamu'alaikum ${name} 👋\n\nPengingat Rundown *${bln}* — batas pengumpulan *Story ${n}* adalah *${dls[n - 1] ? fmtDate(dls[n - 1]) : "minggu ini"}*.${last ? `\nIni story terakhir bulan ini — pastikan Story 1–${q} sudah tersetor semua ya.` : ""}\n${reason ? `Status kamu: ${reason}.\n` : ""}Kalau ada kendala desain atau waktu, yuk segera *berkabar/konsultasi* dengan admin, jangan dipendam sendiri 🙂\n\n🔗 Setor di: ${link}/app/setoran\n\nSemangat! ${["💪", "🚀", "🔥", "✨", "🌟", "🎯"][(n - 1) % 6]}`;
    }
    case "sks":
      return `Halo ${name}, saat ini sudah masuk Fase Cek & Validasi Akhir (SKS). Yuk berkabar atau konsultasi terkait progres Story 1-${q} kamu, bahkan kalau perlu desain bareng dengan admin, AYO kita kerjakan bareng!${reason ? `\n\n📌 ${reason}` : ""}\n\n🔗 ${link}/app/setoran`;
    default:
      return `Assalamu'alaikum ${name} 👋\n\nIni pengingat dari Admin Credible Story terkait rundown ${bln}. Silakan cek portal:\n🔗 ${link}/app`;
  }
}

export function specialReminderMessage(name: string, sp: Pick<SpecialEdition, "title" | "publish_date" | "deadline" | "brief">): string {
  return `Assalamu'alaikum ${name} 👋\n\nKamu adalah *PIC Credible Story Special Edition* 🌟\n*${sp.title}*\n\n📅 Tanggal upload: *${fmtDate(sp.publish_date, true)}*\n⏰ Deadline setor: *${fmtDate(sp.deadline, true)}*${sp.brief ? `\n📝 Brief: ${sp.brief}` : ""}\n\nSpecial Edition dihitung *${SPECIAL_WEIGHT} story* di rekap bulanan. Setor lewat portal ya:\n🔗 ${portalUrl()}/app/setoran\n\nJazakallahu khairan 🙏`;
}

export function retentionMessage(name: string): string {
  return `Halo ${name}, berdasarkan evaluasi rundown bulanan Credible Story, tercatat belum ada setoran karya maupun konfirmasi dari kamu di periode ini. Kami ingin menanyakan secara resmi: Apakah kamu masih berkomitmen untuk lanjut di Tim Credible Story atau tidak? Mohon konfirmasinya. Jika memilih tidak lanjut atau tidak ada kabar, maka status keanggotaan akan kami nonaktifkan. Terima kasih.`;
}

export function designBarengMessage(name: string): string {
  return `Halo ${name} 👋 Admin Credible Story ngajak *Desain Bareng Admin, AYO!* 🎨\nKita kerjakan Story yang masih tertunda bareng-bareng biar cepat tuntas. Kapan kamu longgar hari ini/besok? Balas pesan ini ya 🙂`;
}

export function credentialsMessage(name: string, username: string, password: string): string {
  return `Assalamu'alaikum ${name} 👋\n\nSelamat bergabung di *Tim Credible Story*! 🎉\nBerikut akun portal kamu:\n\n👤 Username: *${username}*\n🔑 Password: *${password}*\n🔗 Login: ${portalUrl()}/login\n\nSaat login pertama kamu akan diminta mengganti password. Jangan bagikan akun ini ke orang lain ya.\n\nBarakallahu fiik 🙏`;
}

export function terminationNotice(name: string): string {
  return `Assalamu'alaikum ${name}. Berdasarkan evaluasi rundown dan tidak adanya konfirmasi, keanggotaan kamu di Tim Credible Story kami nonaktifkan mulai hari ini. Karya yang sudah terbit tetap tersimpan sebagai arsip. Jazakallahu khairan atas kontribusinya selama ini 🙏`;
}

export interface RecapRow {
  member: Pick<Member, "id" | "name" | "category">;
  /** emoji pilihan member; bila kosong memakai emoji default rekap */
  emoji?: string | null;
  /** jumlah story reguler */
  count: number;
  /** jumlah Special Edition (dihitung SPECIAL_WEIGHT) */
  specials?: number;
  excuse?: string | null;
}

export interface RecapSpecial { title: string; publish_date: string; deadline: string; pic: string; sent: boolean; status: string }

export const recapTotal = (r: RecapRow) => r.count + (r.specials ?? 0) * SPECIAL_WEIGHT;

export function buildRecap(opts: {
  periodMonth: string;
  emoji: string;
  rows: RecapRow[];
  footer?: string;
  showZeroWarning: boolean;
  onlyAcc: boolean;
  quota: number;
  specials?: RecapSpecial[];
}): string {
  const { periodMonth, emoji, rows, footer, showZeroWarning, onlyAcc, quota, specials = [] } = opts;
  const SP = "🌟";
  const byCat = (c: Category) => rows.filter((r) => r.member.category === c && recapTotal(r) > 0)
    .sort((a, b) => a.member.name.localeCompare(b.member.name, "id"));
  const line = (r: RecapRow, i: number) => {
    const e = r.emoji || emoji;
    const reg = e.repeat(Math.min(r.count, quota)) + (r.count > quota ? ` (+${r.count - quota})` : "");
    const sp = r.specials ? ` ${SP.repeat(SPECIAL_WEIGHT * r.specials)}` : "";
    return `${i + 1}. ${r.member.name} ${reg}${sp}${r.specials ? ` = ${recapTotal(r)}` : ""}`;
  };
  const regular = rows.reduce((s, r) => s + r.count, 0);
  const specialCount = rows.reduce((s, r) => s + (r.specials ?? 0), 0);
  const total = rows.reduce((s, r) => s + recapTotal(r), 0);
  const contributors = rows.filter((r) => recapTotal(r) > 0).length;
  const ikhwan = byCat("Ikhwan");
  const akhwat = byCat("Akhwat");
  const zero = rows.filter((r) => recapTotal(r) === 0).sort((a, b) => a.member.name.localeCompare(b.member.name, "id"));
  const zeroNoExcuse = zero.filter((r) => !r.excuse);
  const zeroExcuse = zero.filter((r) => r.excuse);

  let out = `${emoji} *REKAP SETORAN CREDIBLE STORY*\n*${monthLabel(periodMonth).toUpperCase()}*${onlyAcc ? " _(lolos QC)_" : ""}\n━━━━━━━━━━━━━━━━━━\n\n`;
  out += `🧔 *IKHWAN*\n${ikhwan.length ? ikhwan.map(line).join("\n") : "_Belum ada setoran_"}\n\n`;
  out += `🧕 *AKHWAT*\n${akhwat.length ? akhwat.map(line).join("\n") : "_Belum ada setoran_"}\n\n`;
  if (specials.length) {
    out += `${SP} *CREDIBLE STORY SPECIAL EDITION*\n${specials.map((s, i) => `${i + 1}. ${s.title} (${fmtDate(s.publish_date)}) — PIC: ${s.pic} ${s.sent ? "✅" : `⏳ _${s.status}_`}`).join("\n")}\n\n`;
  }
  out += `📊 Total: *${total} story* dari *${contributors}/${rows.length}* anggota aktif\n`;
  if (specialCount) out += `   (${regular} reguler + ${specialCount} Special Edition × ${SPECIAL_WEIGHT})\n`;
  const personal = rows.some((r) => r.emoji && r.emoji !== emoji);
  out += personal
    ? `1 emoji = 1 story tersetor (emoji pilihan masing-masing) · Target ${quota} story/bulan\n`
    : `${emoji} = 1 story tersetor · Target ${quota} story/bulan\n`;
  if (specialCount || specials.length) out += `${SP.repeat(SPECIAL_WEIGHT)} = 1 Special Edition (dihitung ${SPECIAL_WEIGHT} story)\n`;
  if (showZeroWarning && zero.length) {
    if (zeroExcuse.length) out += `\n📝 *Berhalangan (ada keterangan):*\n${zeroExcuse.map((r) => `- ${r.member.name} (${r.excuse})`).join("\n")}\n`;
    if (zeroNoExcuse.length)
      out += `\n⚠️ *Belum ada setoran & tanpa keterangan:*\n${zeroNoExcuse.map((r) => `- ${r.member.name}`).join("\n")}\n_Anggota dengan 0 setoran tanpa keterangan akan ditanyakan komitmennya dan dapat dikeluarkan dari tim._\n`;
  }
  if (footer) out += `\n${footer}`;
  return out.trim();
}
