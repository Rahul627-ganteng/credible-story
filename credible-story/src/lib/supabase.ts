import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "credible-story-auth" },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const SUPABASE_URL = url;
export const LOGIN_DOMAIN = "crediblestory.app";
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

/** Pesan error Supabase/Postgres yang ramah dibaca */
export function errMsg(e: unknown): string {
  if (!e) return "Terjadi kesalahan";
  const m = (e as { message?: string }).message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "Username atau password salah.";
  if (/banned/i.test(m)) return "Akun ini sudah dinonaktifkan oleh admin.";
  if (/duplicate key/i.test(m)) return "Data yang sama sudah ada.";
  if (/row-level security/i.test(m)) return "Akses ditolak. Pastikan akun kamu aktif.";
  if (/Payload too large|exceeded the maximum/i.test(m)) return "Ukuran file terlalu besar.";
  if (/mime type/i.test(m)) return "Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.";
  return m;
}
