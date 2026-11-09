import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdmin, RequireMember } from "./auth/Guards";
import { AppLayout, PublicLayout } from "./components/Layout";
import { PageLoader, ToastProvider } from "./components/ui";
import Showcase from "./pages/Showcase";
import Login from "./pages/Login";

const Recruitment = lazy(() => import("./pages/Recruitment"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Taqdim = lazy(() => import("./pages/Taqdim"));
const Setoran = lazy(() => import("./pages/Setoran"));
const Learning = lazy(() => import("./pages/Learning"));
const Rekap = lazy(() => import("./pages/Rekap"));
const Admin = lazy(() => import("./pages/admin/AdminCenter"));

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">Halaman tidak ditemukan</h1>
      <Link to="/" className="btn-primary mt-6">Kembali ke Galeri</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Showcase />} />
                <Route path="/daftar" element={<Recruitment />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/ganti-password" element={<RequireMember><ChangePassword /></RequireMember>} />
              <Route element={<RequireMember><AppLayout /></RequireMember>}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/app/taqdim" element={<Taqdim />} />
                <Route path="/app/setoran" element={<Setoran />} />
                <Route path="/app/belajar" element={<Learning />} />
                <Route path="/app/rekap" element={<Rekap />} />
                <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
