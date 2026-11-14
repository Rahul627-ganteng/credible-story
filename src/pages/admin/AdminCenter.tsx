import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "../../components/ui";
import { activePeriodOf, usePeriods } from "../../lib/hooks";
import { monthLabel } from "../../lib/rundown";
import Overview from "./Overview";
import Members from "./Members";
import Applications from "./Applications";
import TaqdimChecklist from "./TaqdimChecklist";
import QcReview from "./QcReview";
import Reminders from "./Reminders";
import RundownSettings from "./RundownSettings";
import Settings from "./Settings";
import Archive from "./Archive";
import Publish from "./Publish";
import Specials from "./Specials";
import { ADMIN_SECTIONS, sectionFor } from "./sections";
import { useHashBackfill } from "./dedupe";

export default function AdminCenter() {
  const navRef = useRef<HTMLElement>(null);
  const loc = useLocation();
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("a.active")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [loc.pathname]);
  const { data: periods, loading } = usePeriods();
  const [pm, setPm] = useState("");
  useEffect(() => { if (!pm && periods?.length) setPm(activePeriodOf(periods)!.period_month); }, [periods, pm]);
  const period = periods?.find((p) => p.period_month === pm) ?? null;
  const current = sectionFor(loc.pathname);
  useHashBackfill();

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Admin Control Center</p>
          <h1 className="flex items-center gap-2.5 text-3xl font-extrabold"><span className="hidden text-crimson-600 lg:inline [&>svg]:h-7 [&>svg]:w-7">{current.icon}</span>{current.label}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Periode</span>
          <select className="input w-auto" value={pm} onChange={(e) => setPm(e.target.value)}>
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.period_month}>{p.emoji} {monthLabel(p.period_month)}{p.is_active ? " · aktif" : ""}{p.is_locked ? " · terkunci" : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {/* Di PC navigasi ada di sidebar kiri; di HP/tablet berupa strip yang bisa digeser */}
      <nav ref={navRef} aria-label="Bagian Admin" className="no-scrollbar sticky top-14 z-30 -mx-4 flex gap-1 overflow-x-auto bg-canvas/90 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:flex-wrap sm:overflow-visible sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none lg:hidden">
        {ADMIN_SECTIONS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-ink text-white" : "bg-white text-ink-body ring-1 ring-slate-200 hover:ring-slate-300"}`}>
            {t.icon}{t.short}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Overview period={period} />} />
        <Route path="member" element={<Members period={period} />} />
        <Route path="pendaftar" element={<Applications />} />
        <Route path="taqdim" element={<TaqdimChecklist period={period} />} />
        <Route path="qc" element={<QcReview period={period} />} />
        <Route path="publikasi" element={<Publish period={period} />} />
        <Route path="special" element={<Specials />} />
        <Route path="arsip" element={<Archive />} />
        <Route path="pengingat" element={<Reminders period={period} />} />
        <Route path="rundown" element={<RundownSettings periods={periods ?? []} selected={pm} onSelect={setPm} />} />
        <Route path="pengaturan" element={<Settings />} />
      </Routes>
    </div>
  );
}
