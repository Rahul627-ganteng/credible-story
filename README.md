# Credible Story Platform

Ekosistem web terpadu Tim Credible Story: galeri karya publik, pendaftaran tim, portal rundown bulanan (Taqdim → Story 1–3 → Evaluasi), Learning Hub AI, generator rekap WhatsApp, dan Admin Control Center.

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron) · Netlify.

## Halaman & hak akses

| Rute | Akses | Isi |
|---|---|---|
| `/` | Publik | Galeri Kurasi Karya + filter kreator/kategori/bulan/aplikasi, tombol Channel WA |
| `/daftar` | Publik | Recruitment Hub (upload sampel karya) |
| `/login` | Publik | Login username + password |
| `/app` | Member aktif | Dashboard progres, fase rundown, evaluasi bulanan |
| `/app/taqdim` | Member aktif | Taqdim 3 konsep (ACC / revisi oleh admin) |
| `/app/setoran` | Member aktif | Setor Story 1–3 (upload < 10 MB atau link Drive/Canva) |
| `/app/belajar` | Member aktif | Learning Hub — 5 materi baru tiap 48 jam |
| `/app/rekap` | Member aktif | Generator rekap teks WA |
| `/admin/*` | Super Admin | Member, Pendaftar, Validasi Taqdim, QC & Galeri, Pengingat WA, Rundown & Evaluasi, Pengaturan |

## Keamanan

- Login memakai **Supabase Auth** (password di-hash bcrypt). Username dipetakan ke email internal `username@crediblestory.app`.
- Password bawaan **wajib diganti** saat login pertama.
- Seluruh tabel dilindungi **Row Level Security**; nomor HP hanya terbaca oleh pemiliknya dan admin.
- Saat admin mengeluarkan member (`status = terminated`), trigger database menonaktifkan akun (`banned_until = infinity`), menghapus sesi & refresh token, dan aplikasi memutus sesi secara real-time. Karya lama tetap di galeri.

## Akun awal

Akun admin dan 29 member sudah dibuat di database dengan username `namadepan.namabelakang` (mis. `rahul.paris`). Password bawaan dibagikan admin secara pribadi dan **wajib diganti** saat login pertama.

## Integrasi opsional (Supabase › Edge Functions › Secrets)

| Secret | Fungsi |
|---|---|
| `GEMINI_API_KEY` *atau* `ANTHROPIC_API_KEY` | Generator materi Learning Hub (riset web). Jadwal otomatis: pg_cron `0 0 */2 * *` (07.00 WIB, tiap 2 hari) + tombol manual admin |
| `FONNTE_TOKEN` | Blast pengingat WhatsApp otomatis. Tanpa ini, tombol wa.me tetap berfungsi |

## Pengembangan lokal

```bash
npm install
npm run dev
```

Salin `.env.example` menjadi `.env.local` lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (kunci publishable, aman di klien karena RLS). Di Netlify keduanya diatur sebagai environment variable.

## Struktur

```
src/
  auth/        AuthContext (sesi + pencabutan akses real-time), Guards
  components/  Layout, UI kit, PhaseBanner
  lib/         supabase, rundown (fase & preset tanggal), wa (template pesan & rekap), hooks (realtime)
  pages/       Showcase, Recruitment, Login, Dashboard, Taqdim, Setoran, Learning, Rekap
  pages/admin/ AdminCenter + tab-tabnya
supabase/functions/
  generate-materials/  AI riset 5 materi (Gemini / Claude + web search)
  wa-blast/            Kirim WA massal via Fonnte
```
