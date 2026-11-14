import { AlertTriangle, FolderOpen, KeyRound, Pencil, RotateCcw, Search, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { CopyButton, Field, Modal, PageLoader, Spinner, useToast } from "../../components/ui";
import { isLatePhase, phaseOf, quotaOf } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import { DESIGN_APPS, type Category, type Credentials, type Member, type RundownPeriod } from "../../lib/types";
import { normalizePhone, retentionMessage, terminationNotice, waLink } from "../../lib/wa";
import { logReminder, useAdminData } from "./data";
import { CredentialsModal, StatusBadge } from "./shared";
import { WaActions } from "../../components/WaActions";

export default function Members({ period }: { period: RundownPeriod | null }) {
  const pm = period?.period_month ?? "";
  const { member: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAdminData(pm);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "radar" | "terminated" | "all">("active");
  const [edit, setEdit] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [cred, setCred] = useState<(Credentials & { phone?: string | null }) | null>(null);
  const [firing, setFiring] = useState<Member | null>(null);

  if (loading || !data) return <PageLoader />;
  const ph = phaseOf(period);
  const late = isLatePhase(ph, quotaOf(period));
  const countOf = (id: string) => data.stories.filter((s) => s.member_id === id && !s.special_id).length;
  const flagOf = (id: string) => data.flags.find((f) => f.member_id === id);
  const isSilent = (m: Member) => m.is_active && m.role === "member" && countOf(m.id) === 0 && !flagOf(m.id)?.has_kabar;
  const onRadar = (m: Member) => (late && isSilent(m)) || m.status === "confirming_retention" || m.status === "warning_sp1";

  const rows = data.members
    .filter((m) => m.id !== me?.id)
    .filter((m) => view === "all" || (view === "active" ? m.is_active : view === "terminated" ? !m.is_active : onRadar(m)))
    .filter((m) => !q || `${m.name} ${m.username}`.toLowerCase().includes(q.toLowerCase()));
  const radarCount = data.members.filter(onRadar).length;

  const setStatus = async (m: Member, patch: Partial<Member>) => {
    const { error } = await supabase.from("members").update(patch).eq("id", m.id);
    if (error) toast(errMsg(error), "err"); else reload();
  };

  const sendRetention = async (m: Member) => {
    if (m.status === "confirming_retention") { if (pm) await logReminder(m.id, pm, flagOf(m.id)); return; }
    await setStatus(m, { status: "confirming_retention", retention_response: "menunggu" });
    if (pm) await logReminder(m.id, pm, flagOf(m.id));
    toast("Status: Menunggu Konfirmasi");
  };

  const resetPw = async (m: Member) => {
    if (!confirm(`Reset password ${m.name}? Password baru dibuat otomatis.`)) return;
    const { data: res, error } = await supabase.rpc("admin_reset_password", { p_member_id: m.id, p_password: null });
    if (error) return toast(errMsg(error), "err");
    setCred({ ...(res as Credentials), id: m.id, phone: data.phones[m.id] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Cari nama atau username…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {([["active", "Aktif"], ["radar", `Radar (${radarCount})`], ["terminated", "Dikeluarkan"], ["all", "Semua"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${view === k ? (k === "radar" ? "bg-crimson-600 text-white" : "bg-ink text-white") : "text-ink-muted"}`}>{l}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Tambah member</button>
      </div>

      {view === "radar" && (
        <div className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-3 text-sm text-crimson-900">
          <b>Radar Member Tidak Aktif.</b> Anggota dengan 0 setoran dan tanpa kabar {late ? "hingga story terakhir bulan ini" : "(muncul otomatis saat masuk story terakhir / fase SKS)"}, serta yang sedang dalam proses konfirmasi kelanjutan.
        </div>
      )}

      <div className="card overflow-hidden md:overflow-x-auto md:scrollbar-thin">
        {/* Di HP setiap baris tampil sebagai kartu; di layar lebar sebagai tabel */}
        <table className="table-base members-table md:min-w-[860px]">
          <thead className="hidden md:table-header-group"><tr><th>Anggota</th><th>Kategori</th><th>WhatsApp</th><th>Setoran</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {rows.map((m) => {
              const n = countOf(m.id);
              const silent = late && isSilent(m);
              return (
                <tr key={m.id} className={`${!m.is_active ? "opacity-60" : ""} block border-b border-slate-100 px-1 py-2 md:table-row md:p-0`}>
                  <td className="!border-0 md:!border-b">
                    <p className="font-semibold text-ink">{m.name}</p>
                    <p className="font-mono text-xs text-ink-muted">@{m.username}{m.must_change_password && m.is_active && <span className="ml-1.5 text-amber-700">· pw bawaan</span>}</p>
                  </td>
                  <td className="!border-0 !py-0.5 text-xs md:!border-b md:!py-2.5 md:text-sm"><span className="text-ink-muted md:hidden">Kategori: </span>{m.category ?? (m.role === "admin" ? "Admin" : "-")}</td>
                  <td className="!border-0 !py-0.5 font-mono text-xs md:!border-b md:!py-2.5"><span className="font-sans text-ink-muted md:hidden">WA: </span>{data.phones[m.id] ?? <span className="text-crimson-700">belum diisi</span>}</td>
                  <td className="!border-0 !py-0.5 text-xs md:!border-b md:!py-2.5 md:text-sm"><span className="text-ink-muted md:hidden">Setoran: </span>{n}/{quotaOf(period)} {flagOf(m.id)?.has_kabar && n === 0 && <span className="badge-slate ml-1">ada kabar</span>}</td>
                  <td className="space-y-1 !border-0 md:!border-b">
                    <StatusBadge status={m.status} response={m.retention_response} />
                    {silent && <span className="badge-red flex w-fit"><AlertTriangle className="h-3 w-3" /> TIDAK AKTIF / TANPA KABAR</span>}
                    {m.status === "confirming_retention" && (
                      <select className="input mt-1 w-auto py-1 text-xs" value={m.retention_response ?? "menunggu"}
                        onChange={(e) => setStatus(m, { retention_response: e.target.value as Member["retention_response"] })}>
                        <option value="menunggu">Menunggu Konfirmasi</option>
                        <option value="lanjut">Komitmen Lanjut (Dalam Pantauan)</option>
                        <option value="siap_dikeluarkan">Siap Dikeluarkan</option>
                      </select>
                    )}
                  </td>
                  <td className="!border-0 md:!border-b">
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {m.is_active ? (
                        <>
                          {(silent || m.status !== "active") && (
                            <WaActions phone={data.phones[m.id]} message={retentionMessage(m.name)} label="Peringatan & Konfirmasi" variant="soft" copyLabel="Salin" onUse={() => sendRetention(m)} />
                          )}
                          {m.retention_response === "lanjut" && <button className="btn-ghost btn-sm" onClick={() => setStatus(m, { status: "active" })}>Pulihkan aktif</button>}
                          {m.folder_url && <a className="btn-ghost btn-sm" href={m.folder_url} target="_blank" rel="noreferrer" title="Folder Drive"><FolderOpen className="h-3.5 w-3.5" /></a>}
                          <button className="btn-ghost btn-sm" onClick={() => resetPw(m)} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></button>
                          <button className="btn-ghost btn-sm" onClick={() => setEdit(m)} title="Ubah"><Pencil className="h-3.5 w-3.5" /></button>
                          {m.role === "member" && <button className="btn-ghost btn-sm text-crimson-700" onClick={() => setFiring(m)} title="Keluarkan dari Tim"><UserMinus className="h-3.5 w-3.5" /></button>}
                        </>
                      ) : (
                        <button className="btn-ghost btn-sm" onClick={async () => { await setStatus(m, { status: "active" }); toast(`${m.name} diaktifkan kembali`); }}>
                          <RotateCcw className="h-3.5 w-3.5" /> Aktifkan kembali
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-ink-muted">Tidak ada anggota pada tampilan ini.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && <AddMember onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCred(c); reload(); }} />}
      {edit && <EditMember m={edit} phone={data.phones[edit.id] ?? ""} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      <CredentialsModal cred={cred} onClose={() => setCred(null)} />
      {firing && <TerminateModal m={firing} phone={data.phones[firing.id]} onClose={() => setFiring(null)} onDone={() => { setFiring(null); reload(); }} />}
    </div>
  );
}

function SkillPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DESIGN_APPS.map((a) => {
        const on = value.includes(a);
        return <button type="button" key={a} onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-crimson-600 bg-crimson-50 text-crimson-800" : "border-slate-300"}`}>{a}</button>;
      })}
    </div>
  );
}

function AddMember({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Credentials & { phone?: string | null }) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", category: "Ikhwan" as Category, phone: "", folder: "", username: "", password: "", role: "member" });
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.name.trim().length < 2) return toast("Nama wajib diisi", "err");
    const phone = f.phone ? normalizePhone(f.phone) : null;
    if (f.phone && !phone) return toast("Nomor WA tidak valid", "err");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_member", {
      p_name: f.name.trim(), p_category: f.role === "admin" ? null : f.category, p_phone: phone, p_folder_url: f.folder.trim() || null,
      p_skills: skills, p_role: f.role, p_username: f.username.trim() || null, p_password: f.password || null,
    });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    onCreated({ ...(data as Credentials), phone });
  };
  return (
    <Modal open onClose={onClose} title="Tambah member baru" footer={<><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Buat akun</button></>}>
      <div className="space-y-3">
        <Field label="Nama lengkap"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })} disabled={f.role === "admin"}><option>Ikhwan</option><option>Akhwat</option></select></Field>
          <Field label="Peran"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select></Field>
        </div>
        <Field label="Nomor WhatsApp"><input className="input font-mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0812…" /></Field>
        <Field label="URL Folder Drive (opsional)"><input className="input" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="https://drive.google.com/drive/folders/…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username" hint="Kosongkan = otomatis (nama.belakang)"><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
          <Field label="Password awal" hint="Kosongkan = acak 8 karakter"><input className="input font-mono" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
        <div><span className="label">Skill aplikasi</span><SkillPicker value={skills} onChange={setSkills} /></div>
      </div>
    </Modal>
  );
}

function EditMember({ m, phone, onClose, onSaved }: { m: Member; phone: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: m.name, category: m.category ?? "Ikhwan", phone, folder: m.folder_url ?? "", username: m.username, status: m.status });
  const [skills, setSkills] = useState<string[]>(m.skills ?? []);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const p = f.phone ? normalizePhone(f.phone) : null;
    if (f.phone && !p) return toast("Nomor WA tidak valid", "err");
    setBusy(true);
    try {
      const { error } = await supabase.from("members").update({
        name: f.name.trim(), category: m.role === "admin" ? m.category : f.category, folder_url: f.folder.trim() || null, skills,
        ...(f.status !== m.status && f.status !== "terminated" ? { status: f.status } : {}),
      }).eq("id", m.id);
      if (error) throw error;
      if (p !== (phone || null)) {
        const r = await supabase.from("member_contacts").update({ phone_number: p, updated_at: new Date().toISOString() }).eq("member_id", m.id);
        if (r.error) throw r.error;
      }
      if (f.username !== m.username) {
        const r = await supabase.rpc("admin_rename_username", { p_member_id: m.id, p_username: f.username });
        if (r.error) throw r.error;
      }
      toast("Data member tersimpan");
      onSaved();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Ubah · ${m.name}`} footer={<><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Simpan</button></>}>
      <div className="space-y-3">
        <Field label="Nama lengkap"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori"><select className="input" disabled={m.role === "admin"} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}><option>Ikhwan</option><option>Akhwat</option></select></Field>
          <Field label="Username"><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
        </div>
        <Field label="Nomor WhatsApp"><input className="input font-mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="URL Folder Drive"><input className="input" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} /></Field>
        {m.role === "member" && (
          <Field label="Status keanggotaan" hint="Untuk mengeluarkan member, gunakan tombol Keluarkan dari Tim.">
            <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Member["status"] })}>
              <option value="active">Aktif</option>
              <option value="warning_sp1">Peringatan SP1</option>
              <option value="confirming_retention">Konfirmasi kelanjutan</option>
            </select>
          </Field>
        )}
        <div><span className="label">Skill aplikasi</span><SkillPicker value={skills} onChange={setSkills} /></div>
      </div>
    </Modal>
  );
}

function TerminateModal({ m, phone, onClose, onDone }: { m: Member; phone: string | null | undefined; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLowerCase() === m.username;
  const run = async () => {
    setBusy(true);
    const { error } = await supabase.from("members").update({ status: "terminated" }).eq("id", m.id);
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast(`${m.name} dikeluarkan. Sesi login langsung diputus.`);
    if (notify) {
      const link = waLink(phone, terminationNotice(m.name));
      if (link) window.open(link, "_blank");
    }
    onDone();
  };
  return (
    <Modal open onClose={onClose} title="Keluarkan dari Tim (Pecat Member)"
      footer={<><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn bg-crimson-700 text-white hover:bg-crimson-800" disabled={!ok || busy} onClick={run}>{busy && <Spinner />} Keluarkan {m.name.split(" ")[0]}</button></>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-crimson-200 bg-crimson-50 p-4 text-crimson-900">
          <p className="font-semibold">Tindakan ini akan langsung:</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Mengubah status menjadi <b>terminated</b> (<code>is_active = false</code>).</li>
            <li>Mencabut akses login ke Learning Hub &amp; Portal Setoran seketika (sesi aktif diputus).</li>
            <li>Menghapus nama dari dropdown setoran &amp; daftar peserta aktif. Karya lama di Galeri tetap tersimpan sebagai arsip.</li>
          </ol>
        </div>
        <Field label={`Ketik username "${m.username}" untuk konfirmasi`}>
          <input className="input font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-crimson-600" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Buka WhatsApp untuk memberi tahu member</label>
          <CopyButton text={terminationNotice(m.name)} label="Salin teks pemberitahuan" />
        </div>
        <p className="text-xs text-ink-muted">Bisa dibatalkan kapan saja lewat tab Dikeluarkan → Aktifkan kembali.</p>
      </div>
    </Modal>
  );
}
