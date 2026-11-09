import {
  BookOpen, ClipboardList, FileText, GalleryVerticalEnd, LayoutDashboard, LogIn, LogOut, Menu, MessageSquareText,
  ShieldCheck, Upload, UserPlus, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="Credible Story — beranda">
      {compact ? (
        <img src={light ? "/brand/mark-white.webp" : "/brand/mark-black.webp"} alt="Credible Story" className="h-9 w-auto" />
      ) : (
        <img src={light ? "/brand/logo-white.webp" : "/brand/logo-black.webp"} alt="Credible Story" className="h-9 w-auto" width={104} height={36} />
      )}
    </Link>
  );
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive ? "bg-white text-crimson-700 shadow-sm ring-1 ring-slate-200" : "text-ink-body hover:bg-white/70 hover:text-ink"
  }`;

export function PublicLayout() {
  const { member } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const links: { to: string; label: string; icon: ReactNode }[] = [
    { to: "/", label: "Galeri Karya", icon: <GalleryVerticalEnd className="h-4 w-4" /> },
    { to: "/daftar", label: "Daftar Tim", icon: <UserPlus className="h-4 w-4" /> },
  ];
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={linkCls}>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
            <Link to={member ? (member.role === "admin" ? "/admin" : "/app") : "/login"} className="btn-primary ml-2">
              {member ? <LayoutDashboard className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {member ? "Dashboard" : "Login Anggota"}
            </Link>
          </nav>
          <button className="rounded-lg p-2 sm:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-line px-4 pb-4 pt-2 sm:hidden" onClick={() => setOpen(false)}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => `${linkCls({ isActive })} w-full`}>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
            <Link to={member ? "/app" : "/login"} className="btn-primary mt-2 w-full">
              {member ? "Dashboard" : "Login Anggota"}
            </Link>
          </div>
        )}
      </header>
      <main key={loc.pathname} className="animate-fade-up">
        <Outlet />
      </main>
      <footer className="mt-20 bg-ink text-slate-300">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_85%_20%,#991B1B_0,transparent_45%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[auto_1fr]">
            <img src="/brand/marhalah.webp" alt="Logo Marhalah Credible Generation — Gontor Graduate 2023" className="mx-auto h-44 w-auto drop-shadow-2xl md:h-52" loading="lazy" />
            <div>
              <img src="/brand/credible-generation.webp" alt="Credible Generation" className="h-auto w-full max-w-md opacity-95 [filter:invert(1)_grayscale(1)_brightness(1.3)]" loading="lazy" />
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
                Credible Story adalah <span className="font-semibold text-white">Official Story of Credible Generation</span> — angkatan Gontor Graduate 2023 —
                yang menebar pengingat kebaikan lewat story setiap bulannya.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <img src="/brand/official-white.webp" alt="Official Story of Credible Generation" className="h-9 w-auto" loading="lazy" />
                <Link to="/daftar" className="text-sm font-semibold text-crimson-200 hover:text-white">Gabung tim kreator →</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display font-semibold tracking-wide text-slate-300">CREDIBLE STORY · SEBARKAN KEBAIKANMU HARI INI!</p>
            <p>© {new Date().getFullYear()} Tim Credible Story</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function AppLayout() {
  const { member, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const items: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
    { to: "/app", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: "/app/taqdim", label: "Taqdim Konsep", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/app/setoran", label: "Setoran Story", icon: <Upload className="h-4 w-4" /> },
    { to: "/app/belajar", label: "Learning Hub", icon: <BookOpen className="h-4 w-4" /> },
    { to: "/app/rekap", label: "Rekap WA", icon: <MessageSquareText className="h-4 w-4" /> },
    { to: "/", label: "Galeri Publik", icon: <GalleryVerticalEnd className="h-4 w-4" />, end: true },
  ];
  if (isAdmin) items.splice(0, 0, { to: "/admin", label: "Admin Center", icon: <ShieldCheck className="h-4 w-4" /> });

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={linkCls} onClick={() => setOpen(false)}>
          {i.icon}
          {i.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="glass sticky top-0 hidden h-screen flex-col justify-between border-y-0 border-l-0 p-4 lg:flex">
        <div>
          <div className="mb-6 px-1">
            <Logo />
          </div>
          {nav}
        </div>
        <UserCard name={member?.name} sub={isAdmin ? "Super Admin" : `${member?.category ?? ""} · @${member?.username ?? ""}`} onOut={() => signOut()} />
      </aside>

      <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Logo />
        <button className="rounded-lg p-2" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="flex h-full w-72 flex-col justify-between bg-canvas p-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="mb-5 flex items-center justify-between">
                <Logo />
                <button className="rounded-lg p-2" onClick={() => setOpen(false)} aria-label="Tutup">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
            </div>
            <UserCard name={member?.name} sub={isAdmin ? "Super Admin" : `@${member?.username ?? ""}`} onOut={() => signOut()} />
          </div>
        </div>
      )}

      <main key={loc.pathname.split("/").slice(0, 3).join("/")} className="animate-fade-up min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function UserCard({ name, sub, onOut }: { name?: string; sub: string; onOut: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">
          {(name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-ink-muted">{sub}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link to="/ganti-password" className="btn-ghost btn-sm flex-1">
          <FileText className="h-3.5 w-3.5" /> Password
        </Link>
        <button className="btn-ghost btn-sm flex-1" onClick={onOut}>
          <LogOut className="h-3.5 w-3.5" /> Keluar
        </button>
      </div>
    </div>
  );
}
