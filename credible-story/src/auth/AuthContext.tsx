import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, usernameToEmail, errMsg } from "../lib/supabase";
import type { Member } from "../lib/types";

interface AuthState {
  session: Session | null;
  member: Member | null;
  loading: boolean;
  notice: string | null;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  refreshMember: () => Promise<void>;
  clearNotice: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);

  const signOut = useCallback(async (msg?: string) => {
    if (msg) setNotice(msg);
    setMember(null);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setSession(null);
  }, []);

  const loadMember = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from("members").select("*").eq("id", uid).maybeSingle();
    if (error || !data) {
      await signOut("Akun tidak terdaftar sebagai anggota Credible Story.");
      return;
    }
    const m = data as Member;
    if (!m.is_active) {
      await signOut("Akses kamu sudah dicabut karena status keanggotaan dinonaktifkan oleh admin.");
      return;
    }
    setMember(m);
  }, [signOut]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      uidRef.current = data.session?.user.id ?? null;
      if (data.session) await loadMember(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      const uid = s?.user.id ?? null;
      if (uid !== uidRef.current) {
        uidRef.current = uid;
        if (uid) setTimeout(() => loadMember(uid), 0);
        else setMember(null);
      }
      if (event === "SIGNED_OUT") setMember(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMember]);

  // Pencabutan akses seketika: dengarkan perubahan baris member sendiri
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const ch = supabase
      .channel(`me-${uid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members", filter: `id=eq.${uid}` }, (payload) => {
        const m = payload.new as Member;
        if (!m.is_active) signOut("Akses kamu sudah dicabut karena status keanggotaan dinonaktifkan oleh admin.");
        else setMember(m);
      })
      .subscribe();
    const onFocus = () => loadMember(uid);
    window.addEventListener("focus", onFocus);
    const iv = setInterval(() => loadMember(uid), 5 * 60 * 1000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      clearInterval(iv);
    };
  }, [session?.user.id, loadMember, signOut]);

  const signIn = useCallback(async (username: string, password: string) => {
    setNotice(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) throw new Error(errMsg(error));
    uidRef.current = data.user.id;
    setSession(data.session);
    await loadMember(data.user.id);
  }, [loadMember]);

  const refreshMember = useCallback(async () => {
    if (session?.user.id) await loadMember(session.user.id);
  }, [session?.user.id, loadMember]);

  return (
    <Ctx.Provider
      value={{
        session, member, loading, notice,
        isAdmin: member?.role === "admin",
        signIn, signOut, refreshMember,
        clearNotice: () => setNotice(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth harus di dalam AuthProvider");
  return c;
}
