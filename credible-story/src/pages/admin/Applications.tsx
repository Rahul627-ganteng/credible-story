import { Check, ExternalLink, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, PageLoader, useToast } from "../../components/ui";
import { must, useLive } from "../../lib/hooks";
import { fmtDateTime } from "../../lib/rundown";
import { errMsg, supabase } from "../../lib/supabase";
import type { Application, Credentials } from "../../lib/types";
import { waLink } from "../../lib/wa";
import { CredentialsModal } from "./shared";

export default function Applications() {
  const toast = useToast();
  const [status, setStatus] = useState<Application["status"]>("pending");
  const { data, loading, reload } = useLive(async () =>
    must(await supabase.from("recruitment_applications").select("*").eq("status", status).order("created_at", { ascending: false })) as Application[],
  [status], ["recruitment_applications"]);
  const [cred, setCred] = useState<(Credentials & { phone?: string | null }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const approve = async (a: Application) => {
    setBusy(a.id);
    const { data: res, error } = await supabase.rpc("admin_approve_application", { p_app_id: a.id });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    setCred({ ...(res as Credentials), phone: a.phone_number });
    toast(`${a.full_name} diterima — akun dibuat & masuk ke seluruh sistem`);
    reload();
  };
  const reject = async (a: Application) => {
    const note = prompt(`Alasan menolak ${a.full_name}? (opsional)`) ?? null;
    if (note === null && !confirm("Tolak tanpa catatan?")) return;
    const { error } = await supabase.from("recruitment_applications").update({ status: "rejected", admin_notes: note }).eq("id", a.id);
    if (error) toast(errMsg(error), "err"); else { toast("Pendaftar ditolak"); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
        {([["pending", "Menunggu"], ["approved", "Diterima"], ["rejected", "Ditolak"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${status === k ? "bg-ink text-white" : "text-ink-muted"}`}>{l}</button>
        ))}
      </div>
      {loading ? <PageLoader /> : !data?.length ? <Empty title="Tidak ada pendaftar di sini" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-ink">{a.full_name}</p>
                  <p className="text-xs text-ink-muted">{a.category} · {a.skill_level ?? "level ?"} · {fmtDateTime(a.created_at)}</p>
                </div>
                <span className="badge-slate">{a.category}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.design_apps.map((x) => <span key={x} className="badge-red">{x}</span>)}</div>
              {a.motivation && <p className="mt-3 text-sm text-ink-body">“{a.motivation}”</p>}
              <Samples paths={a.sample_paths} />
              {a.portfolio_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">{a.portfolio_urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-crimson-700"><ExternalLink className="h-3 w-3" /> {new URL(u).hostname}</a>)}</div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-ink-muted">
                <span className="font-mono">{a.phone_number}</span>{a.social_media && <span>· {a.social_media}</span>}
                {waLink(a.phone_number, `Assalamu'alaikum ${a.full_name}, kami dari Admin Credible Story terkait pendaftaranmu 🙂`) && (
                  <a className="inline-flex items-center gap-1 font-semibold text-emerald-700" target="_blank" rel="noreferrer" href={waLink(a.phone_number, `Assalamu'alaikum ${a.full_name}, kami dari Admin Credible Story terkait pendaftaranmu 🙂`)!}><MessageCircle className="h-3 w-3" /> Chat</a>
                )}
              </div>
              {a.admin_notes && <p className="mt-2 text-xs text-ink-muted">Catatan: {a.admin_notes}</p>}
              {a.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => approve(a)} disabled={busy === a.id}><Check className="h-4 w-4" /> Terima jadi Member</button>
                  <button className="btn-ghost" onClick={() => reject(a)}><X className="h-4 w-4" /> Tolak</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <CredentialsModal cred={cred} onClose={() => setCred(null)} />
    </div>
  );
}

function Samples({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!paths.length) return;
    supabase.storage.from("recruitment").createSignedUrls(paths, 3600).then(({ data }) => setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]));
  }, [paths.join("|")]);
  if (!urls.length) return null;
  return (
    <div className="mt-3 flex gap-2">
      {urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-28 w-16 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"><img src={u} alt="" className="h-full w-full object-cover" /></a>)}
    </div>
  );
}
