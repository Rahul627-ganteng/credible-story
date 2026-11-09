import { Check, Smile } from "lucide-react";
import { useState } from "react";
import { EMOJI_CHOICES, RESERVED_EMOJI, emojiMapFor, isSingleEmoji } from "../lib/emoji";
import { must, useLive } from "../lib/hooks";
import { emojiFor, monthLabel } from "../lib/rundown";
import { errMsg, supabase } from "../lib/supabase";
import type { MemberEmoji, RundownPeriod } from "../lib/types";
import { Spinner, useToast } from "./ui";

/**
 * Member memilih emoji rekap untuk bulan berjalan. Emoji terbawa ke bulan berikutnya
 * sampai diganti; emoji bulan yang sudah lewat terkunci.
 */
export function EmojiPicker({ memberId, period }: { memberId: string; period: RundownPeriod | null }) {
  const toast = useToast();
  const pm = period?.period_month ?? "";
  const { data, reload } = useLive(async () => {
    if (!pm) return [] as MemberEmoji[];
    return must(await supabase.from("member_emojis").select("*").lte("period_month", pm)) as MemberEmoji[];
  }, [pm], ["member_emojis"]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!period || !data) return null;
  const map = emojiMapFor(data, pm);
  const mine = map.get(memberId);
  const fallback = emojiFor(pm, period);
  const current = mine?.emoji ?? fallback;
  const carried = mine && mine.from !== pm;
  const takenBy = new Map<string, number>();
  for (const [id, v] of map) if (id !== memberId) takenBy.set(v.emoji, (takenBy.get(v.emoji) ?? 0) + 1);

  const choose = async (emoji: string) => {
    if (!isSingleEmoji(emoji)) return toast("Pilih tepat satu emoji", "err");
    if (RESERVED_EMOJI.includes(emoji.trim())) return toast(`${emoji.trim()} dipakai sebagai penanda Special Edition di rekap — pilih emoji lain ya`, "err");
    emoji = emoji.trim();
    setBusy(emoji);
    const { error } = await supabase.from("member_emojis").upsert({ member_id: memberId, period_month: pm, emoji, updated_at: new Date().toISOString() }, { onConflict: "member_id,period_month" });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast(`Emoji rekap ${monthLabel(pm)}: ${emoji}`);
    setCustom(""); setOpen(false);
    reload();
  };

  return (
    <div className="card p-5">
      <p className="label flex items-center gap-1.5"><Smile className="h-3.5 w-3.5" /> Emoji rekap kamu</p>
      <div className="mt-1 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-50 text-4xl ring-1 ring-slate-200">{current}</span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">{monthLabel(pm)}</p>
          <p className="text-xs text-ink-muted">
            {!mine ? "Belum memilih — sementara memakai emoji default bulan ini." : carried ? `Terbawa dari ${monthLabel(mine.from)}. Ganti kalau mau emoji baru bulan ini.` : "Dipakai di rekap WA bulan ini. Bulan depan otomatis terbawa sampai kamu ganti."}
          </p>
          {!open && <button className="btn-ghost btn-sm mt-2" onClick={() => setOpen(true)}>{mine ? "Ganti emoji" : "Pilih emoji"}</button>}
        </div>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJI_CHOICES.map((e) => {
              const taken = takenBy.get(e);
              const on = e === current && !!mine;
              return (
                <button key={e} onClick={() => choose(e)} disabled={!!busy} title={taken ? `Dipakai ${taken} anggota lain` : undefined}
                  className={`relative grid aspect-square place-items-center rounded-xl text-xl transition hover:bg-slate-100 ${on ? "bg-crimson-50 ring-2 ring-crimson-500" : ""}`}>
                  {busy === e ? <Spinner /> : e}
                  {taken && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-slate-400" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-muted"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 align-middle" />= sudah dipakai anggota lain (tetap boleh dipilih)</p>
          <div className="flex gap-2">
            <input className="input text-center text-xl" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="atau ketik emoji lain" maxLength={16} />
            <button className="btn-dark shrink-0" onClick={() => choose(custom)} disabled={!custom || !!busy}><Check className="h-4 w-4" /></button>
          </div>
          <button className="text-sm font-medium text-ink-muted hover:text-ink" onClick={() => setOpen(false)}>Tutup</button>
        </div>
      )}
    </div>
  );
}
