import {
  BookOpen, ClipboardList, FileText, GalleryVerticalEnd, LayoutDashboard, LogIn, LogOut, Menu, MessageSquareText,
  ShieldCheck, Upload, UserPlus, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-crimson-grad shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <rect x="7" y="3" width="10" height="18" rx="2.5" />
          <path d="M10 9h4M10 12.5h4M10 16h2" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-extrabold tracking-tight text-ink">Credible Story</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Platform</span>
        </span>
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
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center">
          <Logo />
          <p>Karya kecil yang konsisten, dakwah yang terus mengalir. © {new Date().getFullYear()} Tim Credible Story</p>
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
