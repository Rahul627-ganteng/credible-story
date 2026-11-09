import { ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Layout";
import { Spinner } from "../components/ui";

export default function Login() {
  const { signIn, member, notice, clearNotice } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      if (member.must_change_password) nav("/ganti-password", { replace: true });
      else nav(loc.state?.from ?? (member.role === "admin" ? "/admin" : "/app"), { replace: true });
    }
  }, [member, nav, loc.state?.from]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    clearNotice();
    setBusy(true);
    try {
      await signIn(username.replace(/^@/, ""), password);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_20%,#DC2626_0,transparent_45%),radial-gradient(circle_at_80%_90%,#991B1B_0,transparent_40%)]" />
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center justify-between">
            <img src="/brand/logo-white.webp" alt="Credible Story" className="h-11 w-auto" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Portal Anggota</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-crimson-200">Sebarkan kebaikanmu hari ini!</p>
            <p className="mt-3 font-display text-4xl font-extrabold leading-tight">Taqdim. Desain. Setor.<br />Evaluasi. Ulangi.</p>
            <p className="mt-4 max-w-sm text-white/70">Satu pintu untuk seluruh rundown bulanan Tim Credible Story — dari konsep sampai karya terbit di galeri.</p>
          </div>
          <div className="flex items-end justify-between gap-6">
            <img src="/brand/official-white.webp" alt="Official Story of Credible Generation" className="h-8 w-auto opacity-80" />
            <div className="flex gap-4 text-xs text-white/60"><span>🟢 Taqdim</span><span>🔵 Story 1</span><span>🔴 Story 2</span><span>🟠 Story 3</span><span>🟣 Story 4</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Galeri publik</Link>
          <Logo />
          <h1 className="mt-8 text-3xl font-extrabold">Masuk ke portal</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Gunakan username dan password dari admin.</p>

          {notice && <p className="mt-6 rounded-xl border border-crimson-200 bg-crimson-50 px-3.5 py-2.5 text-sm font-medium text-crimson-800">{notice}</p>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Username</span>
              <input className="input font-mono" autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nama.belakang" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <div className="relative">
                <input className="input pr-10 font-mono" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tampilkan password">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {err && <p className="rounded-xl bg-crimson-50 px-3 py-2 text-sm font-medium text-crimson-800">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : <LogIn className="h-4 w-4" />} Masuk</button>
          </form>
          <p className="mt-6 text-center text-sm text-ink-muted">Belum jadi anggota? <Link to="/daftar" className="font-semibold text-crimson-700">Daftar tim</Link></p>
        </div>
      </div>
    </div>
  );
}
