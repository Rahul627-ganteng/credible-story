import { ArrowRight, ImagePlus, Link2, Star, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { must, previewUrl, useLive } from "../lib/hooks";
import { compressStory } from "../lib/image";
import { imageHash } from "../lib/phash";
import { removeOriginals, uploadOriginal, type OriginalInfo } from "../lib/originals";
import { addDays, fmtDate, todayJakarta } from "../lib/rundown";
import { specialStatus } from "../lib/special";
import { errMsg, supabase } from "../lib/supabase";
import { DESIGN_APPS, SPECIAL_WEIGHT, type SpecialEdition, type Story } from "../lib/types";
import { Spinner, useToast } from "./ui";

/** Daftar tugas Special Edition milik member (PIC). compact = ringkasan untuk dashboard. */
export function SpecialTasks({ memberId, compact = false }: { memberId: string; compact?: boolean }) {
  const { data, reload } = useLive(async () => {
    const [sp, s] = await Promise.all([
      supabase.from("special_editions").select("*").eq("pic_member_id", memberId).gte("publish_date", addDays(todayJakarta(), -30)).order("deadline"),
      supabase.from("story_submissions").select("*").eq("member_id", memberId).not("special_id", "is", null),
    ]);
    return { specials: must(sp) as SpecialEdition[], subs: must(s) as Story[] };
  }, [memberId], ["special_editions", "story_submissions"]);

  if (!data || data.specials.length === 0) return null;
  const subOf = (id: string) => data.subs.find((s) => s.special_id === id);
  const open = data.specials.filter((sp) => { const sub = subOf(sp.id); return !sub || sub.qc_status !== "acc"; });

  if (compact) {
    if (!open.length) return null;
    return (
      <div className="card border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
        <p className="label flex items-center gap-1.5 text-amber-800"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> Special Edition kamu</p>
        <ul className="mt-2 space-y-2.5">
          {open.map((sp) => {
            const st = specialStatus(sp, subOf(sp.id));
            return (
              <li key={sp.id}>
                <p className="text-sm font-semibold text-ink">{sp.title}</p>
                <p className="text-xs text-ink-muted">Deadline {fmtDate(sp.deadline)} · upload {fmtDate(sp.publish_date)}</p>
                <span className={`${st.cls} mt-1`}>{st.text}</span>
              </li>
            );
          })}
        </ul>
        <Link to="/app/setoran#special" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-800">Setor Special Edition <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    );
  }

  return (
    <section id="special" className="scroll-mt-24 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
        <h2 className="text-lg font-extrabold">Special Edition kamu</h2>
        <span className="badge-amber">dihitung {SPECIAL_WEIGHT}× di rekap</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.specials.map((sp) => <SpecialCard key={sp.id} sp={sp} sub={subOf(sp.id)} memberId={memberId} onDone={reload} />)}
      </div>
    </section>
  );
}

function SpecialCard({ sp, sub, memberId, onDone }: { sp: SpecialEdition; sub?: Story; memberId: string; onDone: () => void }) {
  const toast = useToast();
  const st = specialStatus(sp, sub);
  const canSend = !sub || sub.qc_status === "revision" || sub.qc_status === "pending_qc";
  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [app, setApp] = useState("Canva");
  const [busy, setBusy] = useState(false);
  const src = sub ? previewUrl(sub.file_url, sub.submission_mode) : null;

  const send = async () => {
    setBusy(true);
    try {
      let url = link.trim();
      let hash: string | null = null;
      let orig: OriginalInfo | null = null;
      if (mode === "file") {
        if (!file) throw new Error("Pilih file gambar dulu.");
        const up = await compressStory(file);
        hash = await imageHash(up).catch(() => null);
        const path = `${memberId}/special/${sp.id}-${Date.now()}.${up.name.split(".").pop()}`;
        const [r, o] = await Promise.all([
          supabase.storage.from("stories").upload(path, up, { contentType: up.type, cacheControl: "31536000" }),
          uploadOriginal(file, memberId, "special", sp.id),
        ]);
        if (r.error) throw r.error;
        orig = o;
        url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
      } else if (!/^https:\/\//.test(url)) throw new Error("Tempel link yang diawali https://");
      const row = { submission_mode: mode, file_url: url, design_app: app, title: sp.title, image_hash: hash,
        original_path: orig?.original_path ?? null, original_name: orig?.original_name ?? null, original_size: orig?.original_size ?? null };
      const { error } = sub
        ? await supabase.from("story_submissions").update(row).eq("id", sub.id)
        : await supabase.from("story_submissions").insert({ ...row, member_id: memberId, special_id: sp.id, period_month: sp.period_month, story_target: null });
      if (error) { await removeOriginals([orig?.original_path]); throw error; }
      if (sub?.original_path && sub.original_path !== orig?.original_path) await removeOriginals([sub.original_path]);
      toast("Special Edition terkirim! Menunggu QC admin 🌟");
      setOpenForm(false); setFile(null); setLink("");
      onDone();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card border-amber-200 p-4">
      <div className="flex gap-3">
        <div className="h-24 w-[54px] shrink-0 overflow-hidden rounded-lg bg-amber-50 ring-1 ring-amber-200">
          {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Star className="h-5 w-5 text-amber-300" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight text-ink">{sp.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">⏰ Deadline <b className="text-ink">{fmtDate(sp.deadline, true)}</b> · 📅 Upload {fmtDate(sp.publish_date)}</p>
          <span className={`${st.cls} mt-1.5`}>{st.text}</span>
          {sub?.qc_status === "revision" && sub.qc_notes && <p className="mt-1.5 text-xs text-crimson-800">QC: {sub.qc_notes}</p>}
        </div>
      </div>
      {sp.brief && <p className="mt-3 rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-900">📝 {sp.brief}</p>}
      {canSend && !openForm && (
        <button className="btn-primary mt-3 w-full" onClick={() => setOpenForm(true)}><Upload className="h-4 w-4" /> {sub ? "Kirim ulang" : "Setor Special Edition"}</button>
      )}
      {canSend && openForm && (
        <div className="mt-3 space-y-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["file", "link"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>
                {m === "file" ? <><ImagePlus className="h-4 w-4" /> Gambar</> : <><Link2 className="h-4 w-4" /> Link</>}
              </button>
            ))}
          </div>
          {mode === "file" ? (
            <input type="file" accept="image/png,image/jpeg,image/webp" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          ) : (
            <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
          )}
          <select className="input" value={app} onChange={(e) => setApp(e.target.value)}>{DESIGN_APPS.map((a) => <option key={a}>{a}</option>)}</select>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setOpenForm(false)}>Batal</button>
            <button className="btn-primary flex-1" onClick={send} disabled={busy}>{busy ? <Spinner /> : <Upload className="h-4 w-4" />} Kirim</button>
          </div>
        </div>
      )}
    </div>
  );
}
