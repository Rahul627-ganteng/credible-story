// Credible Story — Generator 5 Materi Belajar (riset web + Pinterest + video YouTube)
// Dipanggil oleh pg_cron (header x-cron-token) setiap 48 jam, atau manual oleh admin (JWT).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APPS = ["Canva", "Figma", "Photoshop", "Illustrator", "After Effects", "CapCut", "PixelLab", "Alight Motion"];
const LEVELS = ["Easy", "Easy", "Intermediate", "Intermediate", "Advanced"];

type Material = {
  title: string;
  design_app: string;
  difficulty_level: "Easy" | "Intermediate" | "Advanced";
  summary: string;
  tutorial_markdown: string;
  pinterest_moodboard: { title: string; note: string; palette: string[]; pinterest_url: string }[];
  challenge_task: string;
  youtube_query: string;
  videos?: Video[];
  videos_checked_at?: string;
};
type Video = { id: string; title: string; channel: string; thumbnail: string };

function buildPrompt(recentTitles: string[], apps: string[]) {
  return `Kamu adalah mentor desain grafis untuk "Credible Story", tim kreator konten story WhatsApp/Instagram (rasio 9:16) bernuansa edukasi Islami & pengembangan diri. Anggotanya beragam: pemula sampai mahir.

TUGAS: Lakukan riset web terbaru (tren desain story/poster vertikal, tutorial resmi aplikasi, dan inspirasi Pinterest), lalu susun TEPAT 5 materi belajar baru.

Aturan komposisi:
- Aplikasi per materi (urut): ${apps.join(", ")}
- Level per materi (urut): ${LEVELS.join(", ")}
- Jangan mengulang topik ini: ${recentTitles.length ? recentTitles.join("; ") : "(belum ada)"}

Aturan isi tiap materi:
- Bahasa Indonesia yang sangat mudah dipahami, ramah pemula, kalimat pendek.
- "tutorial_markdown" berisi bagian: "## Kenapa penting?", "## Langkah praktis" (5-8 langkah bernomor, sebut menu/tombol aplikasi yang nyata), "## Do's", "## Don'ts". Contoh ukuran wajib 1080 × 1920 px.
- "pinterest_moodboard": 3 item. Tiap item: title (kata kunci gaya), note (apa yang perlu diamati — bedah visual singkat), palette (3 kode HEX), pinterest_url = "https://id.pinterest.com/search/pins/?q=" + kata kunci URL-encoded.
- "challenge_task": satu tantangan desain konkret bertema story edukasi Islami/pengembangan diri, dengan kriteria selesai yang jelas.
- "youtube_query": kata kunci pencarian YouTube (3-7 kata, boleh campur Indonesia/Inggris) yang PALING mungkin menemukan video tutorial bagus untuk materi ini. Wajib sebut nama aplikasinya, mis. "tutorial canva teks melengkung story instagram".
- Konten sopan dan sesuai adab; hindari gambar makhluk bernyawa sebagai fokus utama bila memungkinkan.

KELUARKAN HANYA JSON array (tanpa teks lain, tanpa code fence) dengan 5 objek berkunci persis:
title, design_app, difficulty_level, summary, tutorial_markdown, pinterest_moodboard, challenge_task, youtube_query`;
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Respons AI tidak berisi JSON array");
  return JSON.parse(raw.slice(start, end + 1));
}

function validate(items: unknown): Material[] {
  if (!Array.isArray(items)) throw new Error("Format materi tidak valid");
  const out: Material[] = [];
  for (const it of items as Record<string, unknown>[]) {
    const lvl = String(it.difficulty_level ?? "");
    if (!it.title || !it.tutorial_markdown || !["Easy", "Intermediate", "Advanced"].includes(lvl)) continue;
    const mood = Array.isArray(it.pinterest_moodboard) ? (it.pinterest_moodboard as Record<string, unknown>[]) : [];
    out.push({
      title: String(it.title).slice(0, 160),
      design_app: APPS.includes(String(it.design_app)) ? String(it.design_app) : "Canva",
      difficulty_level: lvl as Material["difficulty_level"],
      summary: String(it.summary ?? "").slice(0, 600),
      tutorial_markdown: String(it.tutorial_markdown),
      pinterest_moodboard: mood.slice(0, 4).map((m) => ({
        title: String(m.title ?? "Inspirasi"),
        note: String(m.note ?? ""),
        palette: Array.isArray(m.palette) ? (m.palette as unknown[]).map(String).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 5) : [],
        pinterest_url: String(m.pinterest_url ?? "").startsWith("https://")
          ? String(m.pinterest_url)
          : `https://id.pinterest.com/search/pins/?q=${encodeURIComponent(String(m.title ?? "story design"))}`,
      })),
      challenge_task: String(it.challenge_task ?? ""),
      videos: [],
      youtube_query: (String(it.youtube_query ?? "").trim() || `tutorial ${it.design_app ?? ""} ${it.title}`).slice(0, 120),
    });
  }
  if (out.length < 3) throw new Error(`Hanya ${out.length} materi valid dari AI`);
  return out.slice(0, 5);
}

// ---- YouTube Data API v3 (gratis 10.000 unit/hari; 1 pencarian = 100 unit) ----
const decodeHtml = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function searchYouTube(key: string, q: string): Promise<Video[]> {
  const params = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "3", q, key,
    relevanceLanguage: "id", regionCode: "ID", safeSearch: "strict", videoEmbeddable: "true",
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.items ?? [])
    .filter((it: { id?: { videoId?: string } }) => it.id?.videoId)
    .map((it: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails?: Record<string, { url: string }> } }) => ({
      id: it.id.videoId,
      title: decodeHtml(it.snippet.title),
      channel: decodeHtml(it.snippet.channelTitle),
      thumbnail: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${it.id.videoId}/mqdefault.jpg`,
    }));
}

/** Isi video untuk materi yang belum dicek (atau semua bila force). Berhenti bila kuota habis. */
// deno-lint-ignore no-explicit-any
async function backfillVideos(admin: any, ytKey: string, opts: { force?: boolean; limit?: number } = {}) {
  let q = admin.from("learning_materials").select("id,title,design_app,youtube_query").order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  if (!opts.force) q = q.is("videos_checked_at", null);
  const { data: rows } = await q;
  let filled = 0;
  let error: string | null = null;
  for (const r of rows ?? []) {
    const query = r.youtube_query || `tutorial ${r.design_app} ${r.title}`;
    try {
      const videos = await searchYouTube(ytKey, query);
      await admin.from("learning_materials").update({ videos, youtube_query: query, videos_checked_at: new Date().toISOString() }).eq("id", r.id);
      if (videos.length) filled++;
    } catch (e) {
      error = (e as Error).message;
      break; // kemungkinan kuota harian habis — lanjut otomatis di jadwal berikutnya
    }
  }
  return { checked: rows?.length ?? 0, filled, error };
}

async function geminiOnce(key: string, model: string, prompt: string, withSearch: boolean) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: 0.8, maxOutputTokens: 16000 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini ${model}: respons kosong (${cand?.finishReason ?? "tanpa alasan"})`);
  const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { uri: string; title: string } }) => c.web)
    .filter(Boolean)
    .slice(0, 12)
    .map((w: { uri: string; title: string }) => ({ title: w.title, url: w.uri }));
  return { text, sources, engine: `gemini:${model}${withSearch ? "+search" : ""}` };
}

// Free tier: gemini-2.5-flash + Google Search (gratis s/d 500 req/hari). Cadangan: model Flash terbaru tanpa search.
async function callGemini(key: string, prompt: string) {
  const primary = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const fallback = Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.5-flash";
  try {
    return await geminiOnce(key, primary, prompt, true);
  } catch (e1) {
    try {
      return await geminiOnce(key, fallback, prompt, false);
    } catch (e2) {
      throw new Error(`${(e1 as Error).message} | cadangan: ${(e2 as Error).message}`.slice(0, 480));
    }
  }
}

async function callClaude(key: string, prompt: string) {
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  let text = "";
  const sources: { title: string; url: string }[] = [];
  for (const b of data.content ?? []) {
    if (b.type === "text") text += b.text;
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) sources.push({ title: r.title ?? r.url, url: r.url });
    }
  }
  return { text, sources: sources.slice(0, 12), engine: `claude:${model}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // ---- Otorisasi ----
  let trigger = "cron";
  const cronToken = req.headers.get("x-cron-token");
  if (cronToken) {
    const { data } = await admin.rpc("verify_cron_token", { t: cronToken });
    if (data !== true) return json({ error: "Token cron tidak valid" }, 401);
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Harus login" }, 401);
    const { data: m } = await admin.from("members").select("role,is_active").eq("id", u.user.id).single();
    if (!m || m.role !== "admin" || !m.is_active) return json({ error: "Hanya admin yang bisa generate manual" }, 403);
    trigger = "manual";
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  const ytKey = Deno.env.get("YOUTUBE_API_KEY");
  const body = await req.json().catch(() => ({})) as { action?: string; force?: boolean };

  // Admin: cari ulang video YouTube untuk materi
  if (body.action === "videos") {
    if (!ytKey) return json({ error: "Secret YOUTUBE_API_KEY belum diatur di Supabase › Edge Functions › Secrets. Sementara ini tombol \"Cari di YouTube\" tetap bisa dipakai." }, 400);
    const r = await backfillVideos(admin, ytKey, { force: !!body.force, limit: body.force ? 40 : 20 });
    if (r.error && r.filled === 0) return json({ error: r.error }, 502);
    return json(r);
  }

  // Cron: lengkapi video materi lama yang belum dicek (mis. setelah API key baru ditambahkan)
  // @ts-ignore EdgeRuntime tersedia di Supabase Edge Runtime
  if (trigger === "cron" && ytKey) EdgeRuntime.waitUntil(backfillVideos(admin, ytKey, { limit: 10 }));

  // Cron: lewati bila batch terakhir < 40 jam
  if (trigger === "cron") {
    const { data: last } = await admin.from("learning_materials").select("created_at")
      .neq("generated_by", "seed").order("created_at", { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() < 40 * 3600 * 1000) {
      await admin.from("learning_generation_runs").insert({ trigger, status: "skipped", message: "Batch terakhir < 40 jam", finished_at: new Date().toISOString() });
      return json({ skipped: true });
    }
  }

  if (!geminiKey && !claudeKey) {
    await admin.from("learning_generation_runs").insert({
      trigger, status: "error", finished_at: new Date().toISOString(),
      message: "API key AI belum diatur. Tambahkan secret GEMINI_API_KEY atau ANTHROPIC_API_KEY di Supabase › Edge Functions › Secrets.",
    });
    return json({ error: "API key AI belum diatur (GEMINI_API_KEY atau ANTHROPIC_API_KEY)." }, 400);
  }

  const { data: running } = await admin.from("learning_generation_runs").select("id")
    .eq("status", "running").gte("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(1);
  if (running?.length) return json({ error: "Proses generate lain sedang berjalan. Tunggu beberapa menit." }, 409);

  const { data: run } = await admin.from("learning_generation_runs").insert({ trigger, status: "running" }).select("id").single();

  const work = async () => {
    try {
      const { data: recent } = await admin.from("learning_materials").select("title").order("created_at", { ascending: false }).limit(40);
      const shuffled = [...APPS].sort(() => Math.random() - 0.5).slice(0, 5);
      const prompt = buildPrompt((recent ?? []).map((r) => r.title), shuffled);
      const result = geminiKey ? await callGemini(geminiKey, prompt) : await callClaude(claudeKey!, prompt);
      const items = validate(extractJsonArray(result.text));
      if (ytKey) {
        for (const it of items) {
          try {
            it.videos = await searchYouTube(ytKey, it.youtube_query);
            it.videos_checked_at = new Date().toISOString();
          } catch { break; } // kuota habis → dilengkapi otomatis saat cron berikutnya
        }
      }
      const batchDate = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      const { error } = await admin.from("learning_materials").insert(items.map((it) => ({
        ...it, videos_checked_at: it.videos_checked_at ?? null, batch_date: batchDate, sources: result.sources, generated_by: result.engine,
      })));
      if (error) throw error;
      await admin.from("learning_generation_runs").update({
        status: "success", materials_created: items.length, message: result.engine, finished_at: new Date().toISOString(),
      }).eq("id", run!.id);
    } catch (e) {
      await admin.from("learning_generation_runs").update({
        status: "error", message: String((e as Error).message ?? e).slice(0, 500), finished_at: new Date().toISOString(),
      }).eq("id", run!.id);
    }
  };

  // @ts-ignore EdgeRuntime tersedia di Supabase Edge Runtime
  EdgeRuntime.waitUntil(work());
  return json({ started: true, run_id: run?.id }, 202);
});
