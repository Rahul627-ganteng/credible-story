import {
  BookOpen, ClipboardCheck, FileText, GalleryVerticalEnd, LayoutDashboard, LogIn, LogOut, Menu, MessageSquareText,
  PackageCheck, ShieldCheck, Star, Upload, UserPlus, X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ADMIN_GROUPS } from "../pages/admin/sections";

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

const subLinkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
    isActive ? "bg-white text-crimson-700 shadow-sm ring-1 ring-slate-200" : "text-ink-body hover:bg-white/70 hover:text-ink"
  }`;

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive ? "bg-white text-crimson-700 shadow-sm ring-1 ring-slate-200" : "text-ink-body hover:bg-white/70 hover:text-ink"
  }`;

/** Sembunyikan header saat scroll ke bawah, tampilkan lagi saat scroll ke atas (HP & desktop) */
function useHideOnScroll(disabled = false) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (disabled) { setHidden(false); return; }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last.current;
        if (y < 80) setHidden(false);
        else if (dy > 8) setHidden(true);
        else if (dy < -8) setHidden(false);
        last.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disabled]);
  // Elemen lengket lain (mis. filter galeri) mengikuti tinggi header yang terlihat
  useEffect(() => {
    document.documentElement.style.setProperty("--hdr", hidden ? "0px" : "4rem");
    return () => { document.documentElement.style.removeProperty("--hdr"); };
  }, [hidden]);
  return hidden;
}

export function PublicLayout() {
  const { member } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const hidden = useHideOnScroll(open);
  useEffect(() => setOpen(false), [loc.pathname]);
  const links: { to: string; label: string; icon: ReactNode }[] = [
    { to: "/", label: "Galeri Karya", icon: <GalleryVerticalEnd className="h-4 w-4" /> },
    { to: "/daftar", label: "Daftar Tim", icon: <UserPlus className="h-4 w-4" /> },
  ];
  return (
    <div className="min-h-screen">
      <header className={`glass sticky top-0 z-40 border-x-0 border-t-0 transition-transform duration-300 ${hidden ? "-translate-y-full" : ""}`}>
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
          <button className="-mr-2 rounded-lg p-2.5 sm:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
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
            <Link to={member ? (member.role === "admin" ? "/admin" : "/app") : "/login"} className="btn-primary mt-2 w-full py-3">
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
    { to: "/app/setoran", label: "Setoran Story", icon: <Upload className="h-4 w-4" /> },
    { to: "/app/belajar", label: "Learning Hub", icon: <BookOpen className="h-4 w-4" /> },
    { to: "/app/rekap", label: "Rekap WA", icon: <MessageSquareText className="h-4 w-4" /> },
    { to: "/", label: "Galeri Publik", icon: <GalleryVerticalEnd className="h-4 w-4" />, end: true },
  ];

  const tabs: { to: string; label: string; icon: ReactNode; end?: boolean }[] = isAdmin
    ? [
        { to: "/admin", label: "Admin", icon: <ShieldCheck className="h-5 w-5" />, end: true },
        { to: "/admin/qc", label: "QC", icon: <ClipboardCheck className="h-5 w-5" /> },
        { to: "/admin/publikasi", label: "Publikasi", icon: <PackageCheck className="h-5 w-5" /> },
        { to: "/admin/special", label: "Special", icon: <Star className="h-5 w-5" /> },
      ]
    : [
        { to: "/app", label: "Beranda", icon: <LayoutDashboard className="h-5 w-5" />, end: true },
        { to: "/app/setoran", label: "Setor", icon: <Upload className="h-5 w-5" /> },
        { to: "/app/belajar", label: "Belajar", icon: <BookOpen className="h-5 w-5" /> },
        { to: "/app/rekap", label: "Rekap", icon: <MessageSquareText className="h-5 w-5" /> },
      ];
  useEffect(() => setOpen(false), [loc.pathname]);

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Menu">
      {isAdmin && (
        <div className="mb-3 space-y-3">
          <p className="flex items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-crimson-700"><ShieldCheck className="h-3.5 w-3.5" /> Admin Center</p>
          {ADMIN_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">{g.title}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={subLinkCls} onClick={() => setOpen(false)}>
                    {i.icon}
                    {i.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <div className="mx-3 border-t border-slate-200" />
          <p className="px-3 text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">Portal anggota</p>
        </div>
      )}
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={isAdmin ? subLinkCls : linkCls} onClick={() => setOpen(false)}>
          {i.icon}
          {i.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="glass sticky top-0 hidden h-screen flex-col gap-4 border-y-0 border-l-0 p-4 lg:flex">
        <div className="shrink-0 px-1">
          <Logo />
        </div>
        <div className="scrollbar-thin -mx-2 min-h-0 flex-1 overflow-y-auto px-2">{nav}</div>
        <UserCard name={member?.name} sub={isAdmin ? "Super Admin" : `${member?.category ?? ""} · @${member?.username ?? ""}`} onOut={() => signOut()} />
      </aside>

      <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Logo />
        <button className="rounded-lg p-2" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="pb-safe flex h-full w-[82vw] max-w-xs animate-fade-up flex-col justify-between overflow-y-auto bg-canvas p-4" onClick={(e) => e.stopPropagation()}>
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

      <main key={loc.pathname.split("/").slice(0, 3).join("/")} className="animate-fade-up mb-safe-bar min-w-0 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Tab bar bawah untuk HP */}
      <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 lg:hidden" aria-label="Navigasi utama">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${isActive ? "text-crimson-700" : "text-ink-muted"}`}>
              {({ isActive }) => (<>
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? "bg-crimson-50" : ""}`}>{t.icon}</span>
                {t.label}
              </>)}
            </NavLink>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-ink-muted">
            <span className="grid h-8 w-12 place-items-center rounded-full"><Menu className="h-5 w-5" /></span>
            Lainnya
          </button>
        </div>
      </nav>
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
