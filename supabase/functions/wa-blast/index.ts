// Credible Story — Kirim pengingat WhatsApp otomatis via Fonnte (opsional).
// Hanya admin. Butuh secret FONNTE_TOKEN di Supabase › Edge Functions › Secrets.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Harus login" }, 401);
  const { data: me } = await admin.from("members").select("role,is_active").eq("id", u.user.id).single();
  if (!me || me.role !== "admin" || !me.is_active) return json({ error: "Hanya admin" }, 403);

  const body = await req.json().catch(() => ({}));
  if (body?.check) return json({ configured: Boolean(Deno.env.get("FONNTE_TOKEN")) });

  const token = Deno.env.get("FONNTE_TOKEN");
  if (!token) return json({ error: "FONNTE_TOKEN belum diatur di Supabase Secrets" }, 400);

  const messages: { member_id: string; message: string }[] = Array.isArray(body?.messages) ? body.messages.slice(0, 60) : [];
  if (!messages.length) return json({ error: "Tidak ada pesan" }, 400);

  const ids = messages.map((m) => m.member_id);
  const { data: contacts } = await admin.from("member_contacts").select("member_id,phone_number").in("member_id", ids);
  const { data: active } = await admin.from("members").select("id").in("id", ids).eq("is_active", true);
  const activeSet = new Set((active ?? []).map((a) => a.id));
  const phoneOf = new Map((contacts ?? []).map((c) => [c.member_id, c.phone_number]));

  const results: { member_id: string; ok: boolean; detail?: string }[] = [];
  for (const m of messages) {
    const phone = phoneOf.get(m.member_id);
    if (!activeSet.has(m.member_id) || !phone) {
      results.push({ member_id: m.member_id, ok: false, detail: !phone ? "Nomor HP kosong" : "Member tidak aktif" });
      continue;
    }
    const form = new FormData();
    form.append("target", phone);
    form.append("message", String(m.message).slice(0, 4000));
    form.append("countryCode", "62");
    form.append("delay", "2");
    try {
      const r = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { Authorization: token }, body: form });
      const d = await r.json().catch(() => ({}));
      results.push({ member_id: m.member_id, ok: Boolean(d?.status), detail: d?.reason ?? d?.detail });
    } catch (e) {
      results.push({ member_id: m.member_id, ok: false, detail: String(e) });
    }
  }
  return json({ results, sent: results.filter((r) => r.ok).length });
});
