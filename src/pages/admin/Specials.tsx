import { CalendarDays, CheckCircle2, MessageCircle, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Empty, Field, Modal, PageLoader, Spinner, useToast } from "../../components/ui";
import { must, previewUrl, useLive } from "../../lib/hooks";
import { specialStatus } from "../../lib/special";
import { addDays, fmtDate, monthLabel, todayJakarta } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import { SPECIAL_WEIGHT, type Member, type SpecialEdition, type Story } from "../../lib/types";
import { specialReminderMessage, waLink } from "../../lib/wa";

type Lite = Pick<Member, "id" | "name" | "category" | "is_active" | "role">;

export default function Specials() {
  const toast = useToast();
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const { data, loading, reload } = useLive(async () => {
    const [sp, m, c, s] = await Promise.all([
      supabase.from("special_editions").select("*").order("publish_date", { ascending: true }),
      supabase.from("members").select("id,name,category,is_active,role").eq("role", "member").order("name"),
      supabase.from("member_contacts").select("member_id,phone_number"),
      supabase.from("story_submissions").select("*").not("special_id", "is", null),
    ]);
    const phones: Record<string, string | null> = {};
    (must(c) as { member_id: string; phone_number: string | null }[]).forEach((x) => (phones[x.member_id] = x.phone_number));
    return { specials: must(sp) as SpecialEdition[], members: must(m) as Lite[], phones, subs: must(s) as Story[] };
  }, [], ["special_editions", "story_submissions"]);
  const [edit, setEdit] = useState<SpecialEdition | "new" | null>(null);

  if (loading || !data) return <PageLoader />;
  const today = todayJakarta();
  const subOf = (id: string) => data.subs.find((s) => s.special_id === id);
  const nameOf = (id: string | null) => data.members.find((m) => m.id === id)?.name ?? "— belum ada PIC —";
  const list = data.specials.filter((sp) => view === "all" || sp.publish_date >= addDays(today, -7));
  const pending = data.specials.filter((sp) => sp.publish_date >= today && !specialStatus(sp, subOf(sp.id)).sent).length;

  const remind = (sp: SpecialEdition) => {
    if (!sp.pic_member_id) return toast("Tentukan PIC dulu", "err");
    const link = waLink(data.phones[sp.pic_member_id], specialReminderMessage(nameOf(sp.pic_member_id), sp));
    if (!link) return toast(`Nomor WA ${nameOf(sp.pic_member_id)} belum diisi`, "err");
    window.open(link, "_blank");
  };
  const toggleSent = async (sp: SpecialEdition) => {
    const { error } = await supabase.from("special_editions").update({ marked_sent: !sp.marked_sent, updated_at: new Date().toISOString() }).eq("id", sp.id);
    if (error) toast(errMsg(error), "err"); else reload();
  };

  // kelompokkan per bulan terbit
  const groups = list.reduce<Record<string, SpecialEdition[]>>((acc, sp) => ((acc[sp.period_month] ??= []).push(sp), acc), {});

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-amber-50 to-white p-5">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Star className="h-5 w-5 fill-amber-400" /></span>
          <div>
            <p className="font-display text-lg font-bold text-ink">Credible Story Special Edition</p>
            <p className="text-sm text-ink-muted">Story khusus momen/hari spesial. Satu PIC per story · dihitung <b>{SPECIAL_WEIGHT}× di rekap</b> dan tersinkron dengan rekap bulanan.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setEdit("new")}><Plus className="h-4 w-4" /> Tambah special day</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {([["upcoming", "Mendatang"], ["all", "Semua"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${view === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
          ))}
        </div>
        {pending > 0 && <span className="badge-amber">{pending} special mendatang belum dikirim</span>}
      </div>

      {list.length === 0 ? (
        <Empty icon={<CalendarDays className="h-8 w-8" />} title="Belum ada special day">Tambahkan momen seperti Hari Guru, Maulid Nabi, Hari Ibu, atau Tahun Baru Hijriah.</Empty>
      ) : Object.entries(groups).map(([pm, items]) => (
        <section key={pm}>
          <p className="mb-2 text-sm font-semibold text-ink">{monthLabel(pm)} <span className="font-normal text-ink-muted">· {items.length} special</span></p>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((sp) => {
              const sub = subOf(sp.id);
              const st = specialStatus(sp, sub, today);
              const src = sub ? previewUrl(sub.final_url ?? sub.file_url, sub.final_url ? "file" : sub.submission_mode) : null;
              return (
                <div key={sp.id} className="card flex gap-4 p-4">
                  <div className="h-28 w-16 shrink-0 overflow-hidden rounded-lg bg-amber-50 ring-1 ring-amber-200">
                    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Star className="h-6 w-6 text-amber-300" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold leading-tight text-ink">{sp.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      📅 Upload <b className="text-ink">{fmtDate(sp.publish_date, true)}</b> · ⏰ Deadline <b className="text-ink">{fmtDate(sp.deadline, true)}</b>
                    </p>
                    <p className="text-xs text-ink-muted">👤 PIC: <b className="text-ink">{nameOf(sp.pic_member_id)}</b></p>
                    <span className={`${st.cls} mt-2`}>{st.sent && <CheckCircle2 className="h-3 w-3" />} {st.text}</span>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {!st.sent && <button className="btn-soft btn-sm" onClick={() => remind(sp)}><MessageCircle className="h-3.5 w-3.5" /> Ingatkan PIC</button>}
                      {!sub && <button className="btn-ghost btn-sm" onClick={() => toggleSent(sp)}>{sp.marked_sent ? "Batalkan tanda terkirim" : "Tandai terkirim"}</button>}
                      <button className="btn-ghost btn-sm" onClick={() => setEdit(sp)}><Pencil className="h-3.5 w-3.5" /> Ubah</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {edit && <EditSpecial sp={edit === "new" ? null : edit} members={data.members.filter((m) => m.is_active)} hasSub={edit !== "new" && !!subOf(edit.id)}
        onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function EditSpecial({ sp, members, hasSub, onClose, onDone }: { sp: SpecialEdition | null; members: Lite[]; hasSub: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const today = todayJakarta();
  const [title, setTitle] = useState(sp?.title ?? "");
  const [brief, setBrief] = useState(sp?.brief ?? "");
  const [publish, setPublish] = useState(sp?.publish_date ?? addDays(today, 7));
  const [deadline, setDeadline] = useState(sp?.deadline ?? addDays(today, 4));
  const [pic, setPic] = useState(sp?.pic_member_id ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (title.trim().length < 2) return toast("Isi nama special day", "err");
    if (deadline > publish) return toast("Deadline harus sebelum atau sama dengan tanggal upload", "err");
    setBusy(true);
    const row = { title: title.trim(), brief: brief.trim() || null, publish_date: publish, deadline, pic_member_id: pic || null, updated_at: new Date().toISOString() };
    const { error } = sp ? await supabase.from("special_editions").update(row).eq("id", sp.id) : await supabase.from("special_editions").insert(row);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast(sp ? "Special Edition diperbarui" : "Special day ditambahkan");
    onDone();
  };
  const remove = async () => {
    if (!sp || !confirm(`Hapus special day “${sp.title}”?${hasSub ? " Setoran PIC tetap tersimpan tetapi tidak lagi tertaut." : ""}`)) return;
    setBusy(true);
    const { error } = await supabase.from("special_editions").delete().eq("id", sp.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("Special day dihapus");
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={sp ? "Ubah Special Edition" : "Tambah special day"}
      footer={<>
        {sp && <button className="btn-ghost mr-auto text-crimson-700" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /> Hapus</button>}
        <button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Simpan</button>
      </>}>
      <div className="space-y-3">
        <Field label="Nama special day / momen"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Hari Guru Nasional" maxLength={120} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal upload"><input type="date" className="input font-mono" value={publish} onChange={(e) => setPublish(e.target.value || publish)} /></Field>
          <Field label="Deadline setor"><input type="date" className="input font-mono" value={deadline} max={publish} onChange={(e) => setDeadline(e.target.value || deadline)} /></Field>
        </div>
        <Field label="PIC (satu orang)" hint="Hanya PIC yang bisa menyetor story ini dari portalnya.">
          <select className="input" value={pic} onChange={(e) => setPic(e.target.value)}>
            <option value="">— pilih PIC —</option>
            {(["Ikhwan", "Akhwat"] as const).map((c) => (
              <optgroup key={c} label={c}>{members.filter((m) => m.category === c).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
            ))}
          </select>
        </Field>
        <Field label="Brief / arahan (opsional)"><textarea className="input min-h-[90px]" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Pesan utama, dalil/sumber, nuansa visual…" /></Field>
        <p className="text-xs text-ink-muted">Masuk rekap bulan <b>{monthLabel(publish.slice(0, 7))}</b> (bulan tanggal upload) dan dihitung {SPECIAL_WEIGHT} story untuk PIC.</p>
      </div>
    </Modal>
  );
}
