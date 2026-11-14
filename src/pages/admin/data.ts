import { must, useLive } from "../../lib/hooks";
import { supabase } from "../../lib/supabase";
import type { Member, PeriodFlag, SpecialEdition, Story } from "../../lib/types";

export interface AdminData {
  members: Member[];
  phones: Record<string, string | null>;
  stories: Story[];
  flags: PeriodFlag[];
  /** Special Edition yang terbit di periode ini (untuk hitungan PIC) */
  specials: SpecialEdition[];
}

/** Data gabungan untuk admin pada satu periode, ter-update real-time */
export function useAdminData(pm: string) {
  return useLive<AdminData>(async () => {
    const [m, c, st, f, sp] = await Promise.all([
      supabase.from("members").select("*").order("name"),
      supabase.from("member_contacts").select("member_id,phone_number"),
      pm ? supabase.from("story_submissions").select("*").eq("period_month", pm).eq("is_archive", false) : Promise.resolve({ data: [], error: null }),
      pm ? supabase.from("member_period_flags").select("*").eq("period_month", pm) : Promise.resolve({ data: [], error: null }),
      pm ? supabase.from("special_editions").select("*").eq("period_month", pm).order("publish_date") : Promise.resolve({ data: [], error: null }),
    ]);
    const phones: Record<string, string | null> = {};
    (must(c) as { member_id: string; phone_number: string | null }[]).forEach((x) => (phones[x.member_id] = x.phone_number));
    return {
      members: must(m) as Member[],
      phones,
      stories: must(st) as Story[],
      flags: must(f) as PeriodFlag[],
      specials: must(sp) as SpecialEdition[],
    };
  }, [pm], ["members", "story_submissions", "member_period_flags", "special_editions"]);
}

export async function upsertFlag(memberId: string, pm: string, patch: Partial<PeriodFlag>) {
  const { error } = await supabase.from("member_period_flags").upsert(
    { member_id: memberId, period_month: pm, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "member_id,period_month" },
  );
  if (error) throw error;
}

export async function logReminder(memberId: string, pm: string, current?: PeriodFlag) {
  await upsertFlag(memberId, pm, {
    last_reminded_at: new Date().toISOString(),
    reminder_count: (current?.reminder_count ?? 0) + 1,
  }).catch(() => undefined);
}
