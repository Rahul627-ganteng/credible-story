import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoader } from "../components/ui";
import { useAuth } from "./AuthContext";

export function RequireMember({ children }: { children: ReactNode }) {
  const { session, member, loading } = useAuth();
  const loc = useLocation();
  if (loading || (session && !member)) return <PageLoader label="Memeriksa akses…" />;
  if (!session || !member) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (member.must_change_password && loc.pathname !== "/ganti-password") return <Navigate to="/ganti-password" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return <RequireMember>{isAdmin ? children : <Navigate to="/app" replace />}</RequireMember>;
}
