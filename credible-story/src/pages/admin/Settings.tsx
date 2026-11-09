import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, PageLoader, Spinner, useToast } from "../../components/ui";
import { must, useLive } from "../../lib/hooks";
import { errMsg, supabase } from "../../lib/supabase";

const KEYS = [
  { key: "wa_channel_url", label: "Link Channel WhatsApp Credible Story", hint: "Dipakai tombol “Baca di Channel WA” di galeri publik bila setoran tidak punya link postingan sendiri.", placeholder: "https://whatsapp.com/channel/…" },
  { key: "admin_wa_number", label: "Nomor WhatsApp admin", hint: "Untuk catatan internal / kontak admin.", placeholder: "62812…" },
  { key: "recap_footer", label: "Kalimat penutup rekap WA", hint: "Ditambahkan di bagian bawah teks rekap.", placeholder: "Jazakumullahu khairan…" },
];

export default function Settings() {
  const toast = useToast();
  const { data, loading } = useLive(async () => must(await supabase.from("app_settings").select("key,value")) as { key: string; value: string | null }[], [], []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setVals(Object.fromEntries(data.map((d) => [d.key, d.value ?? ""]))); }, [data]);

  const save = async () => {
    if (vals.wa_channel_url && !/^https:\/\//.test(vals.wa_channel_url)) return toast("Link channel harus diawali https://", "err");
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert(KEYS.map((k) => ({ key: k.key, value: vals[k.key] ?? "", updated_at: new Date().toISOString() })));
    setBusy(false);
    if (error) toast(errMsg(error), "err"); else toast("Pengaturan tersimpan");
  };

  if (loading) return <PageLoader />;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="card space-y-4 p-5">
        {KEYS.map((k) => (
          <Field key={k.key} label={k.label} hint={k.hint}>
            {k.key === "recap_footer"
              ? <textarea className="input min-h-[80px]" value={vals[k.key] ?? ""} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} placeholder={k.placeholder} />
              : <input className="input" value={vals[k.key] ?? ""} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} placeholder={k.placeholder} />}
          </Field>
        ))}
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : <Save className="h-4 w-4" />} Simpan</button>
      </div>
      <div className="card h-fit space-y-3 p-5 text-sm text-ink-body">
        <p className="font-display font-bold text-ink">Integrasi opsional (Supabase › Edge Functions › Secrets)</p>
        <div>
          <p className="font-semibold text-ink">AI Learning Hub</p>
          <p className="text-ink-muted">Isi <code className="font-mono">GEMINI_API_KEY</code> (gratis dari Google AI Studio) <i>atau</i> <code className="font-mono">ANTHROPIC_API_KEY</code>. Generate otomatis berjalan setiap 48 jam pukul 07.00 WIB.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Blast WhatsApp otomatis</p>
          <p className="text-ink-muted">Isi <code className="font-mono">FONNTE_TOKEN</code> dari fonnte.com. Tanpa ini, tombol “Kirim Pengingat WA” tetap berfungsi lewat wa.me.</p>
        </div>
      </div>
    </div>
  );
}
