import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Layout";
import { Spinner, useToast } from "../components/ui";
import { errMsg, supabase } from "../lib/supabase";

export default function ChangePassword() {
  const { member, refreshMember, signOut } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const forced = member?.must_change_password;

  const weak = ["password", "12345678", "87654321", "qwertyui"].includes(pw.toLowerCase());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Password minimal 8 karakter.");
    if (weak) return setErr("Password ini terlalu umum. Pilih yang lain.");
    if (pw !== pw2) return setErr("Konfirmasi password tidak sama.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      const { error: e2 } = await supabase.rpc("mark_password_changed");
      if (e2) throw e2;
      await refreshMember();
      toast("Password berhasil diganti");
      nav(member?.role === "admin" ? "/admin" : "/app", { replace: true });
    } catch (e3) {
      setErr(/same|different/i.test(errMsg(e3)) ? "Password baru harus berbeda dari password lama." : errMsg(e3));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-crimson-50 text-crimson-700"><KeyRound className="h-5 w-5" /></span>
            <div>
              <h1 className="text-xl font-extrabold">{forced ? "Buat password baru" : "Ganti password"}</h1>
              <p className="text-sm text-ink-muted">Halo {member?.name} · <span className="font-mono">@{member?.username}</span></p>
            </div>
          </div>
          {forced && (
            <p className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Demi keamanan, password bawaan dari admin wajib diganti sebelum memakai portal.
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="label">Password baru</span>
              <input className="input font-mono" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
            </label>
            <label className="block"><span className="label">Ulangi password baru</span>
              <input className="input font-mono" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </label>
            {err && <p className="rounded-xl bg-crimson-50 px-3 py-2 text-sm font-medium text-crimson-800">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Simpan password</button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            {!forced ? <button className="font-medium text-ink-muted hover:text-ink" onClick={() => nav(-1)}>Batal</button> : <span />}
            <button className="font-medium text-ink-muted hover:text-ink" onClick={() => signOut()}>Keluar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
