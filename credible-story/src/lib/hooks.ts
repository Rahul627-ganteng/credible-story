import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { RundownPeriod } from "./types";

/** Muat data async + muat ulang otomatis saat tabel berubah (Supabase Realtime) */
export function useLive<T>(loader: () => Promise<T>, deps: unknown[], tables: string[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      const d = await loaderRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!tables.length) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (t) clearTimeout(t);
      t = setTimeout(reload, 350);
    };
    const ch = supabase.channel(`live-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`);
    tables.forEach((table) => ch.on("postgres_changes", { event: "*", schema: "public", table }, debounced));
    ch.subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  return { data, loading, error, reload, setData };
}

/** Throw jika query Supabase gagal; kembalikan data */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? ([] as unknown)) as T;
}

export function usePeriods() {
  return useLive<RundownPeriod[]>(
    async () => must(await supabase.from("rundown_periods").select("*").order("period_month", { ascending: false })),
    [],
    ["rundown_periods"],
  );
}

export function activePeriodOf(periods: RundownPeriod[] | null): RundownPeriod | null {
  if (!periods?.length) return null;
  return periods.find((p) => p.is_active) ?? periods[0];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Thumbnail publik untuk tautan Google Drive (file yang dibagikan "siapa saja dengan link") */
export function previewUrl(url: string, mode: "file" | "link"): string | null {
  if (mode === "file") return url;
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]{20,})/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w720`;
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)) return url;
  return null;
}
