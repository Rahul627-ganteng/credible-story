import { MessageCircle } from "lucide-react";
import { CopyButton, Modal } from "../../components/ui";
import type { Credentials, MemberStatus, RetentionResponse } from "../../lib/types";
import { credentialsMessage, waLink } from "../../lib/wa";

export function CredentialsModal({ cred, onClose }: { cred: (Credentials & { phone?: string | null }) | null; onClose: () => void }) {
  if (!cred) return null;
  const msg = credentialsMessage(cred.name, cred.username, cred.password);
  const link = waLink(cred.phone ?? cred.phone_number, msg);
  return (
    <Modal open onClose={onClose} title="Akun login siap dikirim"
      footer={<>
        <CopyButton text={msg} label="Salin pesan" />
        {link ? <a className="btn-primary" href={link} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Kirim via WhatsApp</a>
          : <span className="self-center text-xs text-ink-muted">Nomor WA belum diisi</span>}
      </>}>
      <p className="text-sm text-ink-muted">Password ini hanya ditampilkan sekali. Member wajib menggantinya saat login pertama.</p>
      <div className="mt-4 space-y-2 rounded-2xl bg-ink p-4 font-mono text-sm text-white">
        <p><span className="text-slate-400">nama     </span>{cred.name}</p>
        <p className="flex items-center justify-between"><span><span className="text-slate-400">username </span>{cred.username}</span><CopyButton text={cred.username} label="" className="rounded-md p-1 text-slate-300 hover:bg-white/10" /></p>
        <p className="flex items-center justify-between"><span><span className="text-slate-400">password </span>{cred.password}</span><CopyButton text={cred.password} label="" className="rounded-md p-1 text-slate-300 hover:bg-white/10" /></p>
      </div>
    </Modal>
  );
}

export function StatusBadge({ status, response }: { status: MemberStatus; response?: RetentionResponse }) {
  if (status === "terminated") return <span className="badge-dark">Dikeluarkan</span>;
  if (status === "confirming_retention") {
    if (response === "lanjut") return <span className="badge-blue">Komitmen Lanjut (Dalam Pantauan)</span>;
    if (response === "siap_dikeluarkan") return <span className="badge-red">Siap Dikeluarkan</span>;
    return <span className="badge-amber">Menunggu Konfirmasi</span>;
  }
  if (status === "warning_sp1") return <span className="badge-amber">Peringatan SP1</span>;
  return <span className="badge-green">Aktif</span>;
}
