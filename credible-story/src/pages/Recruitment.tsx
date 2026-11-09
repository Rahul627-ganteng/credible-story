import { CheckCircle2, ImagePlus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Field, Spinner } from "../components/ui";
import { errMsg, supabase } from "../lib/supabase";
import { DESIGN_APPS, type Category } from "../lib/types";
import { normalizePhone } from "../lib/wa";

const MAX_SAMPLES = 3;
const MAX_MB = 5;

export default function Recruitment() {
  const [form, setForm] = useState({
    full_name: "", category: "" as Category | "", phone_number: "", social_media: "", skill_level: "",
    portfolio: "", motivation: "", commitment: false,
  });
  const [apps, setApps] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { setErr(`${f.name}: hanya PNG/JPG/WEBP.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { setErr(`${f.name}: maksimal ${MAX_MB} MB.`); continue; }
      ok.push(f);
    }
    setFiles((cur) => [...cur, ...ok].slice(0, MAX_SAMPLES));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!form.category) return setErr("Pilih kategori Ikhwan atau Akhwat.");
    if (!normalizePhone(form.phone_number)) return setErr("Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxx");
    if (!apps.length) return setErr("Pilih minimal satu software desain yang dikuasai.");
    if (!form.commitment) return setErr("Centang persetujuan komitmen rundown 3 story/bulan.");
    const urls = form.portfolio.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)).slice(0, 5);
    if (!files.length && !urls.length) return setErr("Lampirkan minimal 1 sampel karya (unggah gambar atau tempel link portofolio).");

    setBusy(true);
    try {
      const folder = crypto.randomUUID();
      const paths: string[] = [];
      for (const [i, f] of files.entries()) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `applications/${folder}/sampel-${i + 1}.${ext}`;
        const { error } = await supabase.storage.from("recruitment").upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await supabase.from("recruitment_applications").insert({
        full_name: form.full_name.trim(),
        category: form.category,
        phone_number: normalizePhone(form.phone_number),
        social_media: form.social_media.trim() || null,
        design_apps: apps,
        skill_level: form.skill_level || null,
        portfolio_urls: urls,
        sample_paths: paths,
        motivation: form.motivation.trim() || null,
        commitment_agreed: true,
        status: "pending",
      });
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-4 text-3xl font-extrabold">Pendaftaran terkirim!</h1>
        <p className="mt-3 text-ink-muted">
          Jazakallahu khairan, {form.full_name.split(" ")[0]}. Admin akan meninjau sampel karyamu dan menghubungi lewat WhatsApp. Jika diterima, akun login portal akan dikirim ke nomor tersebut.
        </p>
        <Link to="/" className="btn-primary mt-8">Lihat Galeri Karya</Link>
      </div>
    );

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_1.4fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow">Recruitment Hub</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Gabung Tim Kreator Credible Story</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          Kami mencari kreator yang mau belajar, konsisten, dan menjaga adab dalam berkarya. Tidak harus jago — yang penting komitmen.
        </p>
        <ol className="mt-8 space-y-4">
          {[
            ["Taqdim 3 konsep", "Di awal bulan kamu mengajukan 3 ide story untuk divalidasi."],
            ["Desain 1 story per minggu", "Minggu 2, 3, dan 4 masing-masing satu story 9:16."],
            ["Belajar bareng", "Akses Learning Hub dengan materi baru setiap 2 hari."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-crimson-grad text-xs font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-display font-bold text-ink">{t}</p>
                <p className="text-sm text-ink-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" className="sm:col-span-2">
            <input className="input" required minLength={2} maxLength={80} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Nama sesuai panggilan di tim" />
          </Field>
          <Field label="Kategori">
            <div className="grid grid-cols-2 gap-2">
              {(["Ikhwan", "Akhwat"] as const).map((c) => (
                <button type="button" key={c} onClick={() => set("category", c)} className={`btn ${form.category === c ? "bg-ink text-white" : "border border-slate-300 bg-white text-ink"}`}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Nomor WhatsApp aktif" hint="Dipakai admin untuk mengirim akun & pengingat.">
            <input className="input" required inputMode="tel" value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} placeholder="0812 3456 7890" />
          </Field>
          <Field label="Instagram / media sosial (opsional)">
            <input className="input" value={form.social_media} onChange={(e) => set("social_media", e.target.value)} placeholder="@username" />
          </Field>
          <Field label="Level kemampuan">
            <select className="input" value={form.skill_level} onChange={(e) => set("skill_level", e.target.value)}>
              <option value="">Pilih…</option>
              <option>Pemula</option>
              <option>Menengah</option>
              <option>Mahir</option>
            </select>
          </Field>
        </div>

        <div>
          <span className="label">Software desain yang dikuasai</span>
          <div className="flex flex-wrap gap-2">
            {DESIGN_APPS.map((a) => {
              const on = apps.includes(a);
              return (
                <button type="button" key={a} onClick={() => setApps(on ? apps.filter((x) => x !== a) : [...apps, a])}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-crimson-600 bg-crimson-50 text-crimson-800" : "border-slate-300 bg-white text-ink-body hover:border-slate-400"}`}>
                  {on && "✓ "}{a}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="label">Sampel karya (maks. {MAX_SAMPLES} gambar, {MAX_MB} MB/gambar)</span>
          <div className="grid grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={{ aspectRatio: "9/16" }}>
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                <button type="button" className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-crimson-700" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {files.length < MAX_SAMPLES && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-ink-muted hover:border-crimson-500 hover:text-crimson-700" style={{ aspectRatio: "9/16" }}>
                <ImagePlus className="h-6 w-6" /> Tambah
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <Field label="Link portofolio (opsional)" hint="Google Drive, Canva, Behance, atau Instagram. Pisahkan dengan spasi.">
          <input className="input" value={form.portfolio} onChange={(e) => set("portfolio", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Motivasi bergabung">
          <textarea className="input min-h-[96px]" maxLength={1500} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} placeholder="Ceritakan singkat alasanmu ingin berdakwah lewat desain…" />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-crimson-200 bg-crimson-50 p-4 text-sm text-crimson-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-crimson-600" checked={form.commitment} onChange={(e) => set("commitment", e.target.checked)} />
          <span>Saya bersedia mengikuti <b>rundown bulanan</b>: taqdim 3 konsep di Minggu 1 dan menyetor <b>3 content story setiap bulan</b>, serta berkabar ke admin bila ada kendala.</span>
        </label>

        {err && <p className="rounded-xl bg-crimson-50 px-3 py-2 text-sm font-medium text-crimson-800">{err}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : <Send className="h-4 w-4" />} Kirim Pendaftaran
        </button>
      </form>
    </div>
  );
}
