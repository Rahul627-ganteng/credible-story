import {
  Archive, BellRing, CalendarRange, ClipboardCheck, ClipboardList, Gauge, PackageCheck, Settings, Star, UserPlus, Users,
} from "lucide-react";
import type { ReactNode } from "react";

export interface AdminSection { to: string; label: string; short: string; icon: ReactNode; end?: boolean }

/** Semua bagian Admin Control Center, dikelompokkan sesuai alur kerja bulanan */
export const ADMIN_GROUPS: { title: string; items: AdminSection[] }[] = [
  {
    title: "Tim",
    items: [
      { to: "/admin", label: "Ringkasan", short: "Ringkasan", icon: <Gauge className="h-4 w-4" />, end: true },
      { to: "/admin/member", label: "Member", short: "Member", icon: <Users className="h-4 w-4" /> },
      { to: "/admin/pendaftar", label: "Pendaftar", short: "Pendaftar", icon: <UserPlus className="h-4 w-4" /> },
    ],
  },
  {
    title: "Alur bulanan",
    items: [
      { to: "/admin/taqdim", label: "Ceklis Taqdim", short: "Taqdim", icon: <ClipboardList className="h-4 w-4" /> },
      { to: "/admin/qc", label: "QC Setoran", short: "QC", icon: <ClipboardCheck className="h-4 w-4" /> },
      { to: "/admin/publikasi", label: "Batch & Publikasi", short: "Publikasi", icon: <PackageCheck className="h-4 w-4" /> },
      { to: "/admin/special", label: "Special Edition", short: "Special", icon: <Star className="h-4 w-4" /> },
      { to: "/admin/pengingat", label: "Pengingat WA", short: "Pengingat", icon: <BellRing className="h-4 w-4" /> },
    ],
  },
  {
    title: "Konten & sistem",
    items: [
      { to: "/admin/arsip", label: "Arsip Karya", short: "Arsip", icon: <Archive className="h-4 w-4" /> },
      { to: "/admin/rundown", label: "Rundown & Evaluasi", short: "Rundown", icon: <CalendarRange className="h-4 w-4" /> },
      { to: "/admin/pengaturan", label: "Pengaturan", short: "Pengaturan", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export const ADMIN_SECTIONS = ADMIN_GROUPS.flatMap((g) => g.items);

export function sectionFor(pathname: string): AdminSection {
  const p = pathname.replace(/\/+$/, "") || "/admin";
  return ADMIN_SECTIONS.find((s) => (s.end ? p === s.to : p === s.to || p.startsWith(s.to + "/"))) ?? ADMIN_SECTIONS[0];
}
