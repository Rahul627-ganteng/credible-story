import { must, useLive } from "../../lib/hooks";
import { supabase } from "../../lib/supabase";
import type { Concept, Member, PeriodFlag, Story } from "../../lib/types";

export interface AdminData {
  members: Member[];
  phones: Record<string, string | null>;
  concepts: Concept[];
  stories: Story[];
  flags: PeriodFlag[];
}

/** Data gabungan untuk admin pada satu periode, ter-update real-time */
export function useAdminData(pm: string) {
  return useLive<AdminData>(async () => {
    const [m, c, cs, st, f] = await Promise.all([
      supabase.from("members").select("*").order("name"),
      supabase.from("member_contacts").select("member_id,phone_number"),
      pm ? supabase.from("concept_submissions").select("*").eq("period_month", pm) : Promise.resolve({ data: [], error: null }),
      pm ? supabase.from("story_submissions").select("*").eq("period_month", pm) : Promise.resolve({ data: [], error: null }),
      pm ? supabase.from("member_period_flags").select("*").eq("period_month", pm) : Promise.resolve({ data: [], error: null }),
    ]);
    const phones: Record<string, string | null> = {};
    (must(c) as { member_id: string; phone_number: string | null }[]).forEach((x) => (phones[x.member_id] = x.phone_number));
    return {
      members: must(m) as Member[],
      phones,
      concepts: must(cs) as Concept[],
      stories: must(st) as Story[],
      flags: must(f) as PeriodFlag[],
    };
  }, [pm], ["members", "concept_submissions", "story_submissions", "member_period_flags"]);
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
